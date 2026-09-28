import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDBArchiveRepository, DB_VERSION } from '../js/storage/indexeddb.js';
import { importAll } from '../js/storage/import.js';

const result=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});
const done=tx=>new Promise((ok,no)=>{tx.oncomplete=ok;tx.onabort=()=>no(tx.error);});
const legacy={id:'old',text:'  original\nwords  ',schemaVersion:3,createdAt:'2020-01-01T00:00:00Z',spokenAt:null,datePrecision:'month',displayDate:'May 2019',source:{type:'typed',conversationId:null,context:null,artifactIds:[]},metadata:{form:'fragment',threads:[],status:'tombstoned'},deletedAt:'2020-02-01T00:00:00Z',deletionReason:'keep history'};

// Layout and row shape from repository commit f983f7b (IndexedDB v3).
// Synthetic content only: this is a historical-format fixture, not a personal archive.
async function oldArchive(factory,record=legacy){
  const r=factory.open('upgrade-test',3);
  r.onupgradeneeded=()=>{
    const db=r.result,u=db.createObjectStore('utterances',{keyPath:'id'});
    u.createIndex('createdAt','createdAt');u.createIndex('spokenAt','spokenAt');u.createIndex('status','metadata.status');
    db.createObjectStore('artifacts',{keyPath:'id'});
    const t=db.createObjectStore('transcriptions',{keyPath:'id'});
    t.createIndex('artifactId','artifactId');t.createIndex('utteranceId','utteranceId');
    const rel=db.createObjectStore('relations',{keyPath:'id'});
    rel.createIndex('fromId','fromId');rel.createIndex('toId','toId');rel.createIndex('status','status');
    db.createObjectStore('meta',{keyPath:'key'});
  };
  const db=await result(r),tx=db.transaction(['utterances','artifacts'],'readwrite');
  tx.objectStore('utterances').add(record);
  tx.objectStore('artifacts').add({id:'photo',blob:new Blob([Uint8Array.from([0,255,10,128])],{type:'image/png'})});
  await done(tx);db.close();
}
async function recovery(factory){
  const db=await result(factory.open('upgrade-test-upgrade-recovery',1));
  const copies=await result(db.transaction('snapshots').objectStore('snapshots').getAll());
  db.close();return copies;
}

test('v3 database backs up raw rows and original bytes before schema writes, then preserves dates and history',async()=>{
  const factory=new IDBFactory();await oldArchive(factory);
  let backupCommitted=false;
  const open=factory.open.bind(factory);
  factory.open=(...args)=>{
    const request=open(...args);
    if(args[0].endsWith('-upgrade-recovery')){
      request.addEventListener('success',()=>{
        const db=request.result,transaction=db.transaction.bind(db);
        db.transaction=(...args)=>{
          const tx=transaction(...args);
          if(args[1]==='readwrite')tx.addEventListener('complete',()=>{backupCommitted=true;});
          return tx;
        };
      });
    }else{
      request.addEventListener('upgradeneeded',()=>{
        const db=request.result,create=db.createObjectStore.bind(db);
        db.createObjectStore=(...args)=>{assert.ok(backupCommitted,'schema changed before backup committed');return create(...args);};
      });
    }
    return request;
  };
  const repository=new IndexedDBArchiveRepository({name:'upgrade-test',indexedDB:factory});
  const db=await repository.open();assert.equal(db.version,DB_VERSION);
  const migrated=await repository.getUtterance('old');
  assert.equal(migrated.text,legacy.text);
  assert.deepEqual(migrated.temporal,{earliest:'2019-05-01',latest:'2019-05-31',precision:'month',display:'May 2019'});
  assert.equal(migrated.metadata.status,'tombstoned');assert.equal(migrated.deletionReason,legacy.deletionReason);
  const [backup]=await recovery(factory);
  assert.equal(backup.version,3);
  assert.deepEqual(backup.stores.utterances.values,[legacy]);
  assert.deepEqual(backup.stores.utterances.keys,['old']);
  assert.deepEqual([...new Uint8Array(await backup.stores.artifacts.values[0].blob.arrayBuffer())],[0,255,10,128]);
  assert.ok(backup.stores.utterances.indexes.some(x=>x.name==='spokenAt'));
  db.close();
});

test('backup failure aborts upgrade and leaves old database version and records untouched',async()=>{
  const factory=new IDBFactory();await oldArchive(factory);
  const open=factory.open.bind(factory);
  factory.open=(...args)=>{
    if(args[0].endsWith('-upgrade-recovery')){
      const request={};queueMicrotask(()=>{request.error=new Error('backup storage full');request.onerror();});return request;
    }
    return open(...args);
  };
  const repository=new IndexedDBArchiveRepository({name:'upgrade-test',indexedDB:factory});
  await assert.rejects(()=>repository.open(),/backup storage full/);
  const db=await result(open('upgrade-test'));
  assert.equal(db.version,3);
  assert.equal(db.objectStoreNames.contains('constellations'),false);
  assert.deepEqual(await result(db.transaction('utterances').objectStore('utterances').get('old')),legacy);
  db.close();
});

test('invalid transformed row aborts entire upgrade but retains recovery copy',async()=>{
  const factory=new IDBFactory();await oldArchive(factory,{...legacy,text:42});
  const repository=new IndexedDBArchiveRepository({name:'upgrade-test',indexedDB:factory});
  await assert.rejects(()=>repository.open(),/utterance.text/);
  const db=await result(factory.open('upgrade-test'));
  assert.equal(db.version,3);db.close();
  assert.equal((await recovery(factory))[0].stores.utterances.values[0].text,42);
});

test('opening the current database neither migrates nor manufactures backups',async()=>{
  const factory=new IDBFactory(),repository=new IndexedDBArchiveRepository({name:'upgrade-test',indexedDB:factory});
  const original=await repository.createUtterance({text:'exact current words'});
  (await repository.open()).close();
  const current=new IndexedDBArchiveRepository({name:'upgrade-test',indexedDB:factory});
  assert.deepEqual(await current.getUtterance(original.id),original);
  assert.deepEqual((await factory.databases()).map(x=>x.name),['upgrade-test']);
  (await current.open()).close();
});

for(const version of [2,3])test(`export v${version} imports legacy chronology and tombstones without loss`,async()=>{
  const repository=new IndexedDBArchiveRepository({indexedDB:new IDBFactory()});
  const payload={exportFormatVersion:version,utterances:[legacy],artifacts:[],transcriptions:[],relations:[]};
  await importAll(repository,payload);
  const restored=await repository.getUtterance('old');
  assert.equal(restored.text,legacy.text);assert.equal(restored.temporal.display,legacy.displayDate);
  assert.equal(restored.temporal.earliest,'2019-05-01');assert.equal(restored.deletedAt,legacy.deletedAt);
  (await repository.open()).close();
});

test('legacy exact time keeps its timestamp rather than reducing it to a day',async()=>{
  const repository=new IndexedDBArchiveRepository({indexedDB:new IDBFactory()});
  const spokenAt='2019-05-02T18:43:22.123Z';
  await importAll(repository,{exportFormatVersion:2,utterances:[{...legacy,datePrecision:'exact',spokenAt}],artifacts:[],transcriptions:[],relations:[]});
  assert.equal((await repository.getUtterance('old')).temporal.earliest,spokenAt);
});
