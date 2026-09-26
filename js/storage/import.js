import { createUtterance } from '../domain/utterance.js';
import { createArtifact } from '../domain/artifact.js';
import { createTranscription } from '../domain/transcription.js';
import { createRelation } from '../domain/relation.js';

const decodeDataURL = data => {
  if (!data) return null;
  const match=String(data).match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if(!match) throw new Error('Artifact data must be a data URL');
  const bytes=match[2]?Uint8Array.from(atob(match[3]),c=>c.charCodeAt(0)):new TextEncoder().encode(decodeURIComponent(match[3]));
  return new Blob([bytes],{type:match[1]||'application/octet-stream'});
};

export function validateImportPayload(payload){
 if(!payload||payload.exportFormatVersion!==2)throw new Error('Unsupported export format version');
 for(const key of ['utterances','artifacts','transcriptions','relations'])if(!Array.isArray(payload[key]))throw new Error(`Import payload missing ${key} array`);
 const utterances=payload.utterances.map(createUtterance);
 const artifacts=payload.artifacts.map(item=>{const {data,...meta}=item;return {meta:createArtifact(meta),blob:decodeDataURL(data)};});
 const transcriptions=payload.transcriptions.map(createTranscription);
 const relations=payload.relations.map(createRelation);
 const utteranceIds=new Set(utterances.map(x=>x.id)),artifactIds=new Set(artifacts.map(x=>x.meta.id));
 const duplicates=(items,label)=>{const seen=new Set();for(const x of items){if(seen.has(x.id))throw new Error(`Duplicate ${label} id in import: ${x.id}`);seen.add(x.id);}};
 duplicates(utterances,'utterance');duplicates(artifacts.map(x=>x.meta),'artifact');duplicates(transcriptions,'transcription');duplicates(relations,'relation');
 for(const t of transcriptions){if(!artifactIds.has(t.artifactId))throw new Error(`Transcription ${t.id} references missing artifact ${t.artifactId}`);if(t.utteranceId&&!utteranceIds.has(t.utteranceId))throw new Error(`Transcription ${t.id} references missing utterance ${t.utteranceId}`);}
 for(const r of relations)if(!utteranceIds.has(r.fromId)||!utteranceIds.has(r.toId))throw new Error(`Relation ${r.id} references missing utterance`);
 for(const u of utterances)for(const id of u.source?.artifactIds||[])if(!artifactIds.has(id))throw new Error(`Utterance ${u.id} references missing artifact ${id}`);
 return {utterances,artifacts,transcriptions,relations};
}

export async function importAll(repository,payload,{dryRun=false,conflict='error'}={}){
 const validated=validateImportPayload(payload);
 if(dryRun)return {success:true,dryRun:true,counts:{utterances:validated.utterances.length,artifacts:validated.artifacts.length,transcriptions:validated.transcriptions.length,relations:validated.relations.length}};
 if(typeof repository.importAll!=='function')throw new Error('Repository does not support atomic import');
 return repository.importAll(validated,{conflict});
}
