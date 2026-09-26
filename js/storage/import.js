import { createUtterance } from '../domain/utterance.js';
import { createArtifact } from '../domain/artifact.js';
import { createTranscription } from '../domain/transcription.js';
import { createRelation } from '../domain/relation.js';
import { createConstellation, createMembership } from '../domain/constellation.js';

const decodeDataURL = data => {
  if (!data) return null;
  const match=String(data).match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if(!match) throw new Error('Artifact data must be a data URL');
  const bytes=match[2]?Uint8Array.from(atob(match[3]),c=>c.charCodeAt(0)):new TextEncoder().encode(decodeURIComponent(match[3]));
  return new Blob([bytes],{type:match[1]||'application/octet-stream'});
};

const addAll=(target,values=[])=>{for(const value of values)target.add(value);return target;};

export function validateImportPayload(payload,{knownUtteranceIds=[],knownArtifactIds=[],knownConstellationIds=[]}={}){
 if(!payload||![2,3].includes(payload.exportFormatVersion))throw new Error('Unsupported export format version');
 for(const key of ['utterances','artifacts','transcriptions','relations'])if(!Array.isArray(payload[key]))throw new Error(`Import payload missing ${key} array`);
 const utterances=payload.utterances.map(createUtterance);
 const artifacts=payload.artifacts.map(item=>{const {data,...meta}=item;return {meta:createArtifact(meta),blob:decodeDataURL(data)};});
 const transcriptions=payload.transcriptions.map(createTranscription);
 const relations=payload.relations.map(createRelation);
 const constellations=(payload.constellations||[]).map(createConstellation);
 const memberships=(payload.memberships||[]).map(createMembership);
 const utteranceIds=addAll(new Set(knownUtteranceIds),utterances.map(x=>x.id));
 const artifactIds=addAll(new Set(knownArtifactIds),artifacts.map(x=>x.meta.id));
 const constellationIds=addAll(new Set(knownConstellationIds),constellations.map(x=>x.id));
 const duplicates=(items,label)=>{const seen=new Set();for(const x of items){if(seen.has(x.id))throw new Error(`Duplicate ${label} id in import: ${x.id}`);seen.add(x.id);}};
 duplicates(utterances,'utterance');duplicates(artifacts.map(x=>x.meta),'artifact');duplicates(transcriptions,'transcription');duplicates(relations,'relation');duplicates(constellations,'constellation');duplicates(memberships,'membership');
 for(const t of transcriptions){if(!artifactIds.has(t.artifactId))throw new Error(`Transcription ${t.id} references missing artifact ${t.artifactId}`);if(t.utteranceId&&!utteranceIds.has(t.utteranceId))throw new Error(`Transcription ${t.id} references missing utterance ${t.utteranceId}`);}
 for(const r of relations)if(!utteranceIds.has(r.fromId)||!utteranceIds.has(r.toId))throw new Error(`Relation ${r.id} references missing utterance`);
 for(const u of utterances)for(const id of u.source?.artifactIds||[])if(!artifactIds.has(id))throw new Error(`Utterance ${u.id} references missing artifact ${id}`);
 for(const m of memberships){if(!constellationIds.has(m.constellationId))throw new Error(`Membership ${m.id} references missing constellation ${m.constellationId}`);if(!utteranceIds.has(m.utteranceId))throw new Error(`Membership ${m.id} references missing utterance ${m.utteranceId}`);}
 return {utterances,artifacts,transcriptions,relations,constellations,memberships};
}

async function knownReferences(repository,payload){
 const incomingUtterances=new Set((payload.utterances||[]).map(x=>x.id));
 const incomingArtifacts=new Set((payload.artifacts||[]).map(x=>x.id));
 const incomingConstellations=new Set((payload.constellations||[]).map(x=>x.id));
 const utteranceRefs=new Set(),artifactRefs=new Set(),constellationRefs=new Set();
 for(const t of payload.transcriptions||[]){if(t.utteranceId)utteranceRefs.add(t.utteranceId);if(t.artifactId)artifactRefs.add(t.artifactId);}
 for(const r of payload.relations||[]){utteranceRefs.add(r.fromId);utteranceRefs.add(r.toId);}
 for(const u of payload.utterances||[])for(const id of u.source?.artifactIds||[])artifactRefs.add(id);
 for(const m of payload.memberships||[]){utteranceRefs.add(m.utteranceId);constellationRefs.add(m.constellationId);}
 const resolve=async(ids,incoming,getter)=>{const found=[];for(const id of ids){if(incoming.has(id))continue;const value=await getter(id);if(value)found.push(id);}return found;};
 const [knownUtteranceIds,knownArtifactIds,knownConstellationIds]=await Promise.all([
  resolve(utteranceRefs,incomingUtterances,id=>repository.getUtterance(id)),
  resolve(artifactRefs,incomingArtifacts,id=>repository.getArtifact(id)),
  resolve(constellationRefs,incomingConstellations,id=>repository.getConstellation(id))
 ]);
 return {knownUtteranceIds,knownArtifactIds,knownConstellationIds};
}

export async function importAll(repository,payload,{dryRun=false,conflict='error'}={}){
 const known=await knownReferences(repository,payload);
 const validated=validateImportPayload(payload,known);
 if(dryRun)return {success:true,dryRun:true,counts:{utterances:validated.utterances.length,artifacts:validated.artifacts.length,transcriptions:validated.transcriptions.length,relations:validated.relations.length,constellations:validated.constellations.length,memberships:validated.memberships.length}};
 if(typeof repository.importAll!=='function')throw new Error('Repository does not support atomic import');
 return repository.importAll(validated,{conflict});
}
