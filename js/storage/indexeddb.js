import { ArchiveRepository } from './repository.js';
import { createUtterance } from '../domain/utterance.js';
import { createArtifact } from '../domain/artifact.js';
import { createTranscription } from '../domain/transcription.js';
import { createRelation } from '../domain/relation.js';
import { validateUtterance, validateTranscription, validateRelation, SCHEMA_VERSION } from '../../data/schema.js';

const DB_VERSION=4, UTTERANCES='utterances', ARTIFACTS='artifacts', TRANSCRIPTIONS='transcriptions', RELATIONS='relations', META='meta';
const clone=v=>v===undefined?undefined:structuredClone(v);
const result=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error||new Error('IndexedDB request failed'));});
const complete=t=>new Promise((ok,no)=>{t.oncomplete=ok;t.onerror=()=>no(t.error||new Error('IndexedDB transaction failed'));t.onabort=()=>no(t.error||new Error('IndexedDB transaction aborted'));});

export class IndexedDBArchiveRepository extends ArchiveRepository {
 constructor({name='all-i-say',indexedDB=globalThis.indexedDB}={}){super();if(!indexedDB)throw new Error('IndexedDB is not available');this.name=name;this.indexedDB=indexedDB;this.databasePromise=null;}
 async open(){if(!this.databasePromise)this.databasePromise=new Promise((ok,no)=>{const r=this.indexedDB.open(this.name,DB_VERSION);r.onupgradeneeded=()=>{const db=r.result,tx=r.transaction;const u=db.objectStoreNames.contains(UTTERANCES)?tx.objectStore(UTTERANCES):db.createObjectStore(UTTERANCES,{keyPath:'id'});if(!u.indexNames.contains('createdAt'))u.createIndex('createdAt','createdAt');if(u.indexNames.contains('spokenAt'))u.deleteIndex('spokenAt');if(!u.indexNames.contains('temporalEarliest'))u.createIndex('temporalEarliest','temporal.earliest');if(!u.indexNames.contains('status'))u.createIndex('status','metadata.status');if(!db.objectStoreNames.contains(ARTIFACTS))db.createObjectStore(ARTIFACTS,{keyPath:'id'});if(!db.objectStoreNames.contains(TRANSCRIPTIONS)){const s=db.createObjectStore(TRANSCRIPTIONS,{keyPath:'id'});s.createIndex('artifactId','artifactId');s.createIndex('utteranceId','utteranceId');}if(!db.objectStoreNames.contains(RELATIONS)){const s=db.createObjectStore(RELATIONS,{keyPath:'id'});s.createIndex('fromId','fromId');s.createIndex('toId','toId');s.createIndex('status','status');}if(!db.objectStoreNames.contains(META))db.createObjectStore(META,{keyPath:'key'});
if(r.oldVersion<4){const req=u.openCursor();req.onsuccess=()=>{const c=req.result;if(!c)return;const v=c.value;if(!v.temporal){v.temporal={earliest:v.spokenAt?String(v.spokenAt).slice(0,10):null,latest:v.spokenAt?String(v.spokenAt).slice(0,10):null,precision:v.datePrecision||'unknown',display:v.displayDate||null};delete v.spokenAt;delete v.datePrecision;delete v.displayDate;c.update(v);}c.continue();};}}
r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error||new Error('Unable to open IndexedDB'));r.onblocked=()=>no(new Error('IndexedDB upgrade is blocked'));});return this.databasePromise;}
 async getUtterance(id){const db=await this.open();return clone(await result(db.transaction(UTTERANCES).objectStore(UTTERANCES).get(id)));}
 async listUtterances({since,until,form,thread,status='kept',limit=100,cursor}={}){const db=await this.open(),tx=db.transaction(UTTERANCES,'readonly'),values=[];await new Promise((ok,no)=>{const r=tx.objectStore(UTTERANCES).index('createdAt').openCursor(null,'prev');r.onsuccess=()=>{const c=r.result;if(!c||values.length>=limit)return ok();const v=c.value,t=v.temporal||{};if((!cursor||v.createdAt<cursor)&&(!since||!t.latest||t.latest>=since)&&(!until||!t.earliest||t.earliest<=until)&&(status===undefined||v.metadata?.status===status)&&(!form||v.metadata?.form===form)&&(!thread||v.metadata?.threads?.includes(thread)))values.push(clone(v));c.continue();};r.onerror=()=>no(r.error);});return values;}
 async createUtterance(data){const v=createUtterance(data),db=await this.open(),tx=db.transaction(UTTERANCES,'readwrite');tx.objectStore(UTTERANCES).add(clone(v));await complete(tx);return clone(v);}
 async tombstoneUtterance(id,reason=null){const db=await this.open(),tx=db.transaction(UTTERANCES,'readwrite'),s=tx.objectStore(UTTERANCES),cur=await result(s.get(id));if(!cur)throw new Error(`Unknown utterance: ${id}`);const v={...cur,metadata:{...cur.metadata,status:'tombstoned'},deletedAt:new Date().toISOString(),deletionReason:reason};validateUtterance(v);s.put(clone(v));await complete(tx);return clone(v);}
 async createArtifact(blob,meta={}){if(!(blob instanceof Blob))throw new Error('Artifact storage requires a Blob');const a=createArtifact({...meta,storageRef:meta.storageRef||'idb://artifact/pending'}),db=await this.open(),tx=db.transaction(ARTIFACTS,'readwrite');tx.objectStore(ARTIFACTS).add({...a,blob});await complete(tx);return clone(a);}
 async getArtifact(id){const db=await this.open();return clone(await result(db.transaction(ARTIFACTS).objectStore(ARTIFACTS).get(id)));}
 async listArtifacts(){const db=await this.open();return (await result(db.transaction(ARTIFACTS).objectStore(ARTIFACTS).getAll())).map(clone);}
 async createTranscription(data){const v=createTranscription(data),db=await this.open(),tx=db.transaction(TRANSCRIPTIONS,'readwrite');tx.objectStore(TRANSCRIPTIONS).add(clone(v));await complete(tx);return clone(v);}
 async listTranscriptions({artifactId,utteranceId}={}){const db=await this.open(),s=db.transaction(TRANSCRIPTIONS).objectStore(TRANSCRIPTIONS);if(!artifactId&&!utteranceId)return (await result(s.getAll())).map(clone);return (await result(s.index(artifactId?'artifactId':'utteranceId').getAll(artifactId||utteranceId))).map(clone);}
 async confirmTranscription(id,attestation={}){const db=await this.open(),tx=db.transaction(TRANSCRIPTIONS,'readwrite'),s=tx.objectStore(TRANSCRIPTIONS),cur=await result(s.get(id));if(!cur)throw new Error(`Unknown transcription: ${id}`);const v={...cur,attestation:{...cur.attestation,...attestation,state:attestation.state||'confirmed-by-author',confirmedAt:attestation.confirmedAt||new Date().toISOString()}};validateTranscription(v);s.put(clone(v));await complete(tx);return clone(v);}
 async createRelation(data){const v=createRelation(data),db=await this.open(),tx=db.transaction(RELATIONS,'readwrite');tx.objectStore(RELATIONS).add(clone(v));await complete(tx);return clone(v);}
 async listRelations({utteranceId,status='active'}={}){const db=await this.open(),s=db.transaction(RELATIONS).objectStore(RELATIONS);let vs;if(utteranceId){const [a,b]=await Promise.all([result(s.index('fromId').getAll(utteranceId)),result(s.index('toId').getAll(utteranceId))]);vs=[...a,...b];}else vs=await result(s.getAll());const seen=new Set();return vs.filter(v=>!seen.has(v.id)&&seen.add(v.id)&&(status===undefined||v.status===status)).map(clone);}
 async withdrawRelation(id,reason=null){const db=await this.open(),tx=db.transaction(RELATIONS,'readwrite'),s=tx.objectStore(RELATIONS),cur=await result(s.get(id));if(!cur)throw new Error(`Unknown relation: ${id}`);const v={...cur,status:'withdrawn',deletedAt:new Date().toISOString(),withdrawalReason:reason};validateRelation(v);s.put(clone(v));await complete(tx);return clone(v);}
 async importAll(payload,{conflict='error'}={}){
  if(!['error','skip'].includes(conflict))throw new Error('Unsupported import conflict policy');
  const db=await this.open(),names=[UTTERANCES,ARTIFACTS,TRANSCRIPTIONS,RELATIONS],tx=db.transaction(names,'readwrite');
  const stores={utterances:tx.objectStore(UTTERANCES),artifacts:tx.objectStore(ARTIFACTS),transcriptions:tx.objectStore(TRANSCRIPTIONS),relations:tx.objectStore(RELATIONS)};
  const existing=async(store,id)=>Boolean(await result(store.get(id)));
  try{
   for(const u of payload.utterances){if(await existing(stores.utterances,u.id)){if(conflict==='skip')continue;throw new Error(`Import conflict: utterance ${u.id}`);}stores.utterances.add(clone(u));}
   for(const a of payload.artifacts){if(await existing(stores.artifacts,a.meta.id)){if(conflict==='skip')continue;throw new Error(`Import conflict: artifact ${a.meta.id}`);}stores.artifacts.add({...clone(a.meta),blob:a.blob});}
   for(const t of payload.transcriptions){if(await existing(stores.transcriptions,t.id)){if(conflict==='skip')continue;throw new Error(`Import conflict: transcription ${t.id}`);}stores.transcriptions.add(clone(t));}
   for(const r of payload.relations){if(await existing(stores.relations,r.id)){if(conflict==='skip')continue;throw new Error(`Import conflict: relation ${r.id}`);}stores.relations.add(clone(r));}
  }catch(error){tx.abort();throw error;}
  await complete(tx);
  return {success:true,dryRun:false,counts:{utterances:payload.utterances.length,artifacts:payload.artifacts.length,transcriptions:payload.transcriptions.length,relations:payload.relations.length},conflict};
 }
 async getSchemaVersion(){return SCHEMA_VERSION;}
}
export { DB_VERSION };
