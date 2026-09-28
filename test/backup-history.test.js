import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDBArchiveRepository } from '../js/storage/indexeddb.js';
import { InMemoryArchiveRepository } from '../js/storage/in-memory.js';
import { exportAll } from '../js/storage/export.js';
import { importAll } from '../js/storage/import.js';
import { backupRepository } from '../js/storage/backup.js';

const archive=()=>new IndexedDBArchiveRepository({name:'backup-test',indexedDB:new IDBFactory()});
async function historyFixture(){
  const repository=archive();
  const first=await repository.createUtterance({id:'first',text:'unchanged\n  exact words'});
  const second=await repository.createUtterance({id:'second',text:'another position'});
  const relation=await repository.createRelation({id:'relation',fromId:first.id,toId:second.id,type:'continues',provenance:{origin:'author'}});
  const retired=await repository.createConstellation({id:'retired',name:'Past gathering',status:'retired',provenance:{origin:'author'}});
  await repository.createConstellation({id:'active',name:'Current gathering',provenance:{origin:'author'}});
  const membership=await repository.createMembership({id:'membership',utteranceId:first.id,constellationId:retired.id,provenance:{origin:'author'}});
  const withdrawnRelation=await repository.withdrawRelation(relation.id,'later withdrawn');
  const withdrawnMembership=await repository.withdrawMembership(membership.id,'moved on');
  const tombstone=await repository.tombstoneUtterance(first.id,'preserved history');
  return {repository,tombstone,second,withdrawnRelation,withdrawnMembership,retired};
}

test('full backup round trip preserves tombstones, withdrawals, retired Places and exact words',async()=>{
  const {repository,tombstone,second,withdrawnRelation,withdrawnMembership,retired}=await historyFixture();
  const exported=await exportAll(repository);
  assert.equal(exported.utterances.length,2);
  assert.equal(exported.relations.length,1);
  assert.equal(exported.memberships.length,1);
  assert.equal(exported.constellations.length,2);
  const restored=archive();
  await importAll(restored,JSON.parse(JSON.stringify(exported)));
  assert.deepEqual(await restored.getUtterance(tombstone.id),tombstone);
  assert.deepEqual(await restored.getUtterance(second.id),second);
  assert.deepEqual(await restored.listRelations({includeHistory:true}),[withdrawnRelation]);
  assert.deepEqual(await restored.listMemberships({includeHistory:true}),[withdrawnMembership]);
  assert.deepEqual(await restored.getConstellation(retired.id),retired);
  // Re-importing the same backup is a no-op, not a conflict caused by lost metadata.
  const skipped=await importAll(restored,exported,{conflict:'skip'});
  assert.equal(skipped.skipped.utterances,2);
  assert.equal(skipped.skipped.relations,1);
});

test('history is selected explicitly and undefined retains normal filtering',async()=>{
  const {repository}=await historyFixture();
  for(const [method,current,all] of [['listUtterances',1,2],['listRelations',0,1],['listMemberships',0,1],['listConstellations',1,2]]){
    assert.equal((await repository[method]()).length,current);
    assert.equal((await repository[method]({status:undefined})).length,current);
    assert.equal((await repository[method]({includeHistory:false})).length,current);
    assert.equal((await repository[method]({includeHistory:true})).length,all);
  }
  assert.equal((await repository.listUtterances({status:'tombstoned'})).length,1);
  assert.equal((await repository.listUtterances({includeHistory:true,limit:1})).length,1);
  const memory=new InMemoryArchiveRepository(await repository.listUtterances({includeHistory:true}));
  assert.equal((await memory.listUtterances()).length,1);
  assert.equal((await memory.listUtterances({status:undefined})).length,1);
  assert.equal((await memory.listUtterances({includeHistory:true})).length,2);
});

test('pre-migration utterance snapshots include tombstones',async()=>{
  const {repository,tombstone}=await historyFixture();
  const previous=globalThis.localStorage;
  const values=new Map();
  globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  try{
    const {key,backup}=await backupRepository(repository,'2026-01-01T00:00:00.000Z');
    assert.equal(backup.utterances.length,2);
    assert.deepEqual(JSON.parse(values.get(key)).utterances.find(x=>x.id===tombstone.id),tombstone);
  }finally{
    if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;
  }
});
