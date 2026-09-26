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

function normalizeImportPayload(payload){
 if(!payload||![2,3].includes(payload.exportFormatVersion))throw new Error('Unsupported export format version');
 for(const key of ['utterances','artifacts','transcriptions','relations'])if(!Array.isArray(payload[key]))throw new Error(`Import payload missing ${key} array`);
 const utterances=payload.utterances.map(createUtterance);
 const artifacts=payload.artifacts.map(item=>{const {data,...meta}=item;return {meta:createArtifact(meta),blob:decodeDataURL(data)};});
 const transcriptions=payload.transcriptions.map(createTranscription);
 const relations=payload.relations.map(createRelation);
 const constellations=(payload.constellations||[]).map(createConstellation);
 const memberships=(payload.memberships||[]).map(createMembership);
 const duplicates=(items,label)=>{const seen=new Set();for(const x of items){if(seen.has(x.id))throw new Error(`Duplicate ${label} id in import: ${x.id}`);seen.add(x.id);}};
 duplicates(utterances,'utterance');duplicates(artifacts.map(x=>x.meta),'artifact');duplicates(transcriptions,'transcription');duplicates(relations,'relation');duplicates(constellations,'constellation');duplicates(memberships,'membership');
 return {utterances,artifacts,transcriptions,relations,constellations,memberships};
}

function validateReferences(value,{utteranceIds=[],artifactIds=[],constellationIds=[]}={}){
 const knownUtterances=new Set([...utteranceIds,...value.utterances.map(x=>x.id)]);
 const knownArtifacts=new Set([...artifactIds,...value.artifacts.map(x=>x.meta.id)]);
 const knownConstellations=new Set([...constellationIds,...value.constellations.map(x=>x.id)]);
 for(const t of value.transcriptions){if(!knownArtifacts.has(t.artifactId))throw new Error(`Transcription ${t.id} references missing artifact ${t.artifactId}`);if(t.utteranceId&&!knownUtterances.has(t.utteranceId))throw new Error(`Transcription ${t.id} references missing utterance ${t.utteranceId}`);}
 for(const r of value.relations)if(!knownUtterances.has(r.fromId)||!knownUtterances.has(r.toId))throw new Error(`Relation ${r.id} references missing utterance`);
 for(const u of value.utterances)for(const id of u.source?.artifactIds||[])if(!knownArtifacts.has(id))throw new Error(`Utterance ${u.id} references missing artifact ${id}`);
 for(const m of value.memberships){if(!knownConstellations.has(m.constellationId))throw new Error(`Membership ${m.id} references missing constellation ${m.constellationId}`);if(!knownUtterances.has(m.utteranceId))throw new Error(`Membership ${m.id} references missing utterance ${m.utteranceId}`);}
 return value;
}

export function validateImportPayload(payload,known={}){
 return validateReferences(normalizeImportPayload(payload),known);
}

async function existingReferenceIds(repository,value){
 const incomingUtterances=new Set(value.utterances.map(x=>x.id));
 const incomingArtifacts=new Set(value.artifacts.map(x=>x.meta.id));
 const incomingConstellations=new Set(value.constellations.map(x=>x.id));
 const neededUtterances=new Set(),neededArtifacts=new Set(),neededConstellations=new Set();
 for(const t of value.transcriptions){if(t.utteranceId&&!incomingUtterances.has(t.utteranceId))neededUtterances.add(t.utteranceId);if(!incomingArtifacts.has(t.artifactId))neededArtifacts.add(t.artifactId);}
 for(const r of value.relations){if(!incomingUtterances.has(r.fromId))neededUtterances.add(r.fromId);if(!incomingUtterances.has(r.toId))neededUtterances.add(r.toId);}
 for(const u of value.utterances)for(const id of u.source?.artifactIds||[])if(!incomingArtifacts.has(id))neededArtifacts.add(id);
 for(const m of value.memberships){if(!incomingUtterances.has(m.utteranceId))neededUtterances.add(m.utteranceId);if(!incomingConstellations.has(m.constellationId))neededConstellations.add(m.constellationId);}
 const resolve=async(ids,method)=>{const found=[];if(typeof repository[method]!=='function')return found;await Promise.all([...ids].map(async id=>{if(await repository[method](id))found.push(id);}));return found;};
 const [utteranceIds,artifactIds,constellationIds]=await Promise.all([resolve(neededUtterances,'getUtterance'),resolve(neededArtifacts,'getArtifact'),resolve(neededConstellations,'getConstellation')]);
 return {utteranceIds,artifactIds,constellationIds};
}

export async function importAll(repository,payload,{dryRun=false,conflict='error'}={}){
 const normalized=normalizeImportPayload(payload);
 const known=await existingReferenceIds(repository,normalized);
 const validated=validateReferences(normalized,known);
 const counts={utterances:validated.utterances.length,artifacts:validated.artifacts.length,transcriptions:validated.transcriptions.length,relations:validated.relations.length,constellations:validated.constellations.length,memberships:validated.memberships.length};
 if(dryRun)return {success:true,dryRun:true,counts};
 if(typeof repository.importAll!=='function')throw new Error('Repository does not support atomic import');
 return repository.importAll(validated,{conflict});
}
