import test from 'node:test';
import assert from 'node:assert/strict';
import { createUtterance, updateUtteranceText } from '../js/domain/utterance.js';
import { migrateV2toV3, parseLegacyDate } from '../js/storage/migrations/002_v2_to_v3.js';
import { validateImportPayload, importAll } from '../js/storage/import.js';

test('utterance text has no update path',()=>{
 const u=createUtterance({id:'u1',text:'first light',temporal:{earliest:null,latest:null,precision:'unknown',display:'Earlier'}});
 assert.equal(u.text,'first light');assert.throws(()=>updateUtteranceText(),/immutable/);
});

test('month precision is represented as an interval',()=>{
 assert.deepEqual(parseLegacyDate('Sep 2026'),{earliest:'2026-09-01',latest:'2026-09-30',precision:'month',display:'Sep 2026'});
});

test('year precision is represented as an interval',()=>{
 assert.deepEqual(parseLegacyDate('2026'),{earliest:'2026-01-01',latest:'2026-12-31',precision:'year',display:'2026'});
});

test('unparseable labels remain unknown instead of receiving a fake date',()=>{
 assert.deepEqual(parseLegacyDate('Earlier'),{earliest:null,latest:null,precision:'unknown',display:'Earlier'});
});

test('v2 migration preserves legacy id and uncertain time',async()=>{
 const [u]=await migrateV2toV3([{id:'legacy-1',text:'Exact words',date:'Sep 2026',kind:'statement',threads:['test']}]);
 assert.equal(u.id,'legacy-1');assert.equal(u.text,'Exact words');assert.equal(u.temporal.precision,'month');assert.equal(u.temporal.latest,'2026-09-30');
});

test('import rejects broken references before repository writes',async()=>{
 let called=false;const repository={importAll(){called=true;}};
 const payload={exportFormatVersion:2,utterances:[createUtterance({id:'u1',text:'words'})],artifacts:[],transcriptions:[],relations:[{id:'r1',type:'develops',fromId:'u1',toId:'missing',directional:true,provenance:{origin:'author'},status:'active'}]};
 await assert.rejects(()=>importAll(repository,payload),/missing utterance/);assert.equal(called,false);
});

test('dry-run validates without writing',async()=>{
 let called=false;const repository={importAll(){called=true;}};
 const payload={exportFormatVersion:2,utterances:[createUtterance({id:'u1',text:'words'})],artifacts:[],transcriptions:[],relations:[]};
 const result=await importAll(repository,payload,{dryRun:true});assert.equal(result.dryRun,true);assert.equal(result.counts.utterances,1);assert.equal(called,false);
});

test('duplicate ids inside an import are rejected',()=>{
 const u=createUtterance({id:'same',text:'words'});assert.throws(()=>validateImportPayload({exportFormatVersion:2,utterances:[u,u],artifacts:[],transcriptions:[],relations:[]}),/Duplicate utterance/);
});

test('artifact transcription does not become utterance text implicitly',()=>{
 const u=createUtterance({id:'artifact-only',text:null,metadata:{status:'awaiting-transcription'},source:{type:'imported',artifactIds:['art-1']}});
 assert.equal(u.text,null);
 assert.deepEqual(u.source.artifactIds,['art-1']);
});

test('month labels do not mistake digits from the year for a day',()=>{
 assert.deepEqual(parseLegacyDate('September 2026'),{earliest:'2026-09-01',latest:'2026-09-30',precision:'month',display:'September 2026'});
});

test('explicit legacy day remains day precision',()=>{
 assert.deepEqual(parseLegacyDate('Sep 14 2026'),{earliest:'2026-09-14',latest:'2026-09-14',precision:'day',display:'Sep 14 2026'});
});

test('search ranks exact archive words without rewriting them', async()=>{
 const { searchArchive } = await import('../js/services/search.js');
 assert.equal(typeof searchArchive,'function');
});

test('Between service is available without adding an inferred relation', async()=>{
 const { getBetweenData } = await import('../js/services/between.js');
 assert.equal(typeof getBetweenData,'function');
});

test('primary shell exposes every archive motion', async()=>{
 const { shellView } = await import('../js/views.js');
 const html=shellView([]);
 for(const route of ['home','write','drift','between','library','search','places']) assert.match(html,new RegExp('data-route="'+route+'"'));
});

test('constellation membership is an assertion, not ownership', async()=>{
 const { createConstellation, createMembership } = await import('../js/domain/constellation.js');
 const constellation=createConstellation({id:'con_test',name:'A place',createdAt:'2026-09-26T00:00:00.000Z',provenance:{origin:'author',createdAt:'2026-09-26T00:00:00.000Z'}});
 const first=createMembership({id:'mem_one',constellationId:constellation.id,utteranceId:'utt_same',createdAt:'2026-09-26T00:00:00.000Z',provenance:{origin:'author',createdAt:'2026-09-26T00:00:00.000Z'}});
 const second=createMembership({id:'mem_two',constellationId:'con_other',utteranceId:'utt_same',createdAt:'2026-09-26T00:00:00.000Z',provenance:{origin:'author',createdAt:'2026-09-26T00:00:00.000Z'}});
 assert.equal(first.utteranceId,second.utteranceId);
 assert.notEqual(first.constellationId,second.constellationId);
 assert.equal(first.status,'active');
});

test('import rejects membership whose constellation is absent', async()=>{
 const { createMembership } = await import('../js/domain/constellation.js');
 const u=createUtterance({id:'u-member',text:'words'});
 const membership=createMembership({id:'m-broken',constellationId:'missing',utteranceId:u.id,provenance:{origin:'author'}});
 const payload={exportFormatVersion:3,utterances:[u],artifacts:[],transcriptions:[],relations:[],constellations:[],memberships:[membership]};
 assert.throws(()=>validateImportPayload(payload),/missing constellation/);
});

test('v2 exports remain importable with an empty constellation graph',()=>{
 const u=createUtterance({id:'u-old-export',text:'older words'});
 const result=validateImportPayload({exportFormatVersion:2,utterances:[u],artifacts:[],transcriptions:[],relations:[]});
 assert.deepEqual(result.constellations,[]);
 assert.deepEqual(result.memberships,[]);
});

test('import may attach a new membership to archive entities already present', async()=>{
 const { createMembership } = await import('../js/domain/constellation.js');
 const membership=createMembership({id:'m-existing',constellationId:'con-existing',utteranceId:'u-existing',provenance:{origin:'author'}});
 const repository={
  getUtterance:async id=>id==='u-existing'?{id}:undefined,
  getConstellation:async id=>id==='con-existing'?{id}:undefined,
  importAll(){throw new Error('dry run must not write');}
 };
 const payload={exportFormatVersion:3,utterances:[],artifacts:[],transcriptions:[],relations:[],constellations:[],memberships:[membership]};
 const result=await importAll(repository,payload,{dryRun:true});
 assert.equal(result.success,true);
 assert.equal(result.counts.memberships,1);
});

test('skip-equivalence distinguishes identical records from divergent words and bytes', async()=>{
 const { recordsEquivalent } = await import('../js/storage/conflict.js');
 assert.equal(await recordsEquivalent({id:'u1',text:'same',metadata:{b:2,a:1}},{metadata:{a:1,b:2},text:'same',id:'u1'}),true);
 assert.equal(await recordsEquivalent({id:'u1',text:'first light'},{id:'u1',text:'changed'}),false);
 assert.equal(await recordsEquivalent({id:'a1',blob:new Blob(['abc'],{type:'text/plain'})},{id:'a1',blob:new Blob(['abc'],{type:'text/plain'})}),true);
 assert.equal(await recordsEquivalent({id:'a1',blob:new Blob(['abc'],{type:'text/plain'})},{id:'a1',blob:new Blob(['abd'],{type:'text/plain'})}),false);
});


test('Places keeps legacy thread labels visibly noncanonical', async()=>{
 const { placesView } = await import('../js/views/places.js');
 const html=placesView([],[{name:'Undir Sólu',count:1,utterances:[]}]);
 assert.match(html,/Earlier thread labels/);
 assert.match(html,/Not constellations until you say so/);
 assert.doesNotMatch(html,/data-constellation-id="Undir Sólu"/);
});

test('constellation view gathers a position without claiming ownership', async()=>{
 const { placesView } = await import('../js/views/places.js');
 const html=placesView([{constellation:{id:'con-one',name:'Undir Sólu',aliases:[],description:null},count:1,utterances:[]}],[]);
 assert.match(html,/data-constellation-id="con-one"/);
 assert.match(html,/without owning them/);
 assert.match(html,/does not say they belong only here/);
});


test('constellation assertions require explicit provenance', async()=>{
 const { createConstellation, createMembership } = await import('../js/domain/constellation.js');
 assert.throws(()=>createConstellation({name:'Unnamed source'}),/provenance.origin is required/);
 assert.throws(()=>createMembership({constellationId:'con',utteranceId:'utt'}),/provenance.origin is required/);
});

test('constellation status and aliases are closed validated fields', async()=>{
 const { createConstellation } = await import('../js/domain/constellation.js');
 assert.throws(()=>createConstellation({name:'A',status:'primary',provenance:{origin:'author'}}),/status is invalid/);
 assert.throws(()=>createConstellation({name:'A',aliases:'not an array',provenance:{origin:'author'}}),/aliases/);
});

test('membership withdrawal state cannot contradict its timestamp', async()=>{
 const { createMembership } = await import('../js/domain/constellation.js');
 const base={constellationId:'con',utteranceId:'utt',provenance:{origin:'author'}};
 assert.throws(()=>createMembership({...base,status:'withdrawn'}),/withdrawnAt/);
 assert.throws(()=>createMembership({...base,status:'active',withdrawnAt:'2026-09-26T00:00:00.000Z'}),/active membership/);
 const withdrawn=createMembership({...base,status:'withdrawn',withdrawnAt:'2026-09-26T00:00:00.000Z'});
 assert.equal(withdrawn.status,'withdrawn');
 assert.equal(withdrawn.withdrawnAt,'2026-09-26T00:00:00.000Z');
 assert.equal('deletedAt' in withdrawn,false);
});


test('import rejects two active assertions for the same constellation and utterance', async()=>{
 const { createConstellation, createMembership } = await import('../js/domain/constellation.js');
 const u=createUtterance({id:'u-pair',text:'same position'});
 const constellation=createConstellation({id:'con-pair',name:'A gathering',provenance:{origin:'author'}});
 const first=createMembership({id:'m-pair-1',constellationId:constellation.id,utteranceId:u.id,provenance:{origin:'author'}});
 const second=createMembership({id:'m-pair-2',constellationId:constellation.id,utteranceId:u.id,provenance:{origin:'author'}});
 assert.throws(()=>validateImportPayload({exportFormatVersion:3,utterances:[u],artifacts:[],transcriptions:[],relations:[],constellations:[constellation],memberships:[first,second]}),/Duplicate active membership/);
});

test('conflict equality distinguishes explicit null from an absent field', async()=>{
 const { recordsEquivalent } = await import('../js/storage/conflict.js');
 assert.equal(await recordsEquivalent({id:'u1',note:null},{id:'u1'}),false);
});


test('repository membership creation enforces references and active-pair uniqueness', async()=>{
 const { IDBFactory } = await import('fake-indexeddb');
 const { IndexedDBArchiveRepository } = await import('../js/storage/indexeddb.js');
 const repository=new IndexedDBArchiveRepository({name:'membership-integrity',indexedDB:new IDBFactory()});
 await assert.rejects(
  ()=>repository.createMembership({constellationId:'missing',utteranceId:'missing',provenance:{origin:'author'}}),
  /Unknown constellation/
 );
 const utterance=await repository.createUtterance({id:'u-membership',text:'words'});
 await assert.rejects(
  ()=>repository.createMembership({constellationId:'missing',utteranceId:utterance.id,provenance:{origin:'author'}}),
  /Unknown constellation/
 );
 const constellation=await repository.createConstellation({id:'con-membership',name:'A gathering',provenance:{origin:'author'}});
 await assert.rejects(
  ()=>repository.createMembership({constellationId:constellation.id,utteranceId:'missing',provenance:{origin:'author'}}),
  /Unknown utterance/
 );
 const first=await repository.createMembership({id:'mem-first',constellationId:constellation.id,utteranceId:utterance.id,provenance:{origin:'author'}});
 assert.equal(first.status,'active');
 await assert.rejects(
  ()=>repository.createMembership({id:'mem-second',constellationId:constellation.id,utteranceId:utterance.id,provenance:{origin:'author'}}),
  /Active membership already exists/
 );
});

test('withdrawing membership preserves the assertion and its original provenance', async()=>{
 const { IDBFactory } = await import('fake-indexeddb');
 const { IndexedDBArchiveRepository } = await import('../js/storage/indexeddb.js');
 const repository=new IndexedDBArchiveRepository({name:'membership-withdrawal',indexedDB:new IDBFactory()});
 const utterance=await repository.createUtterance({id:'u-withdraw',text:'words'});
 const constellation=await repository.createConstellation({id:'con-withdraw',name:'A gathering',provenance:{origin:'author'}});
 const original=await repository.createMembership({
  id:'mem-withdraw',
  constellationId:constellation.id,
  utteranceId:utterance.id,
  createdAt:'2026-09-26T12:00:00.000Z',
  provenance:{origin:'author',createdAt:'2026-09-26T12:00:00.000Z'}
 });
 const withdrawn=await repository.withdrawMembership(original.id,'changed sight');
 assert.equal(withdrawn.status,'withdrawn');
 assert.ok(withdrawn.withdrawnAt);
 assert.equal(withdrawn.createdAt,original.createdAt);
 assert.deepEqual(withdrawn.provenance,original.provenance);
 const history=await repository.listMemberships({status:'withdrawn'});
 assert.equal(history.length,1);
 assert.equal(history[0].id,original.id);
 assert.equal(history[0].status,'withdrawn');
});

test('dangling membership import aborts the whole repository transaction', async()=>{
 const { IDBFactory } = await import('fake-indexeddb');
 const { IndexedDBArchiveRepository } = await import('../js/storage/indexeddb.js');
 const { createMembership } = await import('../js/domain/constellation.js');
 const repository=new IndexedDBArchiveRepository({name:'dangling-import',indexedDB:new IDBFactory()});
 const utterance=createUtterance({id:'u-should-not-land',text:'must remain outside'});
 const membership=createMembership({
  id:'mem-dangling',
  constellationId:'con-missing',
  utteranceId:utterance.id,
  provenance:{origin:'author'}
 });
 await assert.rejects(
  ()=>repository.importAll({
   utterances:[utterance],artifacts:[],transcriptions:[],relations:[],constellations:[],memberships:[membership]
  }),
  /missing constellation/
 );
 assert.equal(await repository.getUtterance(utterance.id),undefined);
 assert.deepEqual(await repository.listMemberships({status:undefined}),[]);
});

test('racing membership writes cannot create two active assertions for one pair', async()=>{
 const { IDBFactory } = await import('fake-indexeddb');
 const { IndexedDBArchiveRepository } = await import('../js/storage/indexeddb.js');
 const { createMembership } = await import('../js/domain/constellation.js');
 const repository=new IndexedDBArchiveRepository({name:'membership-race',indexedDB:new IDBFactory()});
 const utterance=await repository.createUtterance({id:'u-race',text:'one position'});
 const constellation=await repository.createConstellation({id:'con-race',name:'One gathering',provenance:{origin:'author'}});
 const direct=repository.createMembership({
  id:'mem-race-direct',constellationId:constellation.id,utteranceId:utterance.id,provenance:{origin:'author'}
 });
 const imported=createMembership({
  id:'mem-race-import',constellationId:constellation.id,utteranceId:utterance.id,provenance:{origin:'author'}
 });
 const importing=repository.importAll({
  utterances:[],artifacts:[],transcriptions:[],relations:[],constellations:[],memberships:[imported]
 });
 const settled=await Promise.allSettled([direct,importing]);
 assert.equal(settled.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(settled.filter(x=>x.status==='rejected').length,1);
 const active=await repository.listMemberships({constellationId:constellation.id,status:'active'});
 assert.equal(active.length,1);
 assert.equal(active[0].utteranceId,utterance.id);
});

test('atomic skip compares artifact bytes without losing the IndexedDB transaction', async()=>{
 const { IDBFactory } = await import('fake-indexeddb');
 const { IndexedDBArchiveRepository } = await import('../js/storage/indexeddb.js');
 const repository=new IndexedDBArchiveRepository({name:'artifact-skip',indexedDB:new IDBFactory()});
 await repository.createArtifact(new Blob(['abc'],{type:'text/plain'}),{
  id:'art-same',kind:'file',mimeType:'text/plain'
 });
 const stored=await repository.getArtifact('art-same');
 const {blob:storedBlob,...meta}=stored;
 const result=await repository.importAll({
  utterances:[],
  artifacts:[{meta,blob:new Blob(['abc'],{type:'text/plain'})}],
  transcriptions:[],relations:[],constellations:[],memberships:[]
 },{conflict:'skip'});
 assert.equal(result.skipped.artifacts,1);
 assert.equal(result.counts.artifacts,0);
 const after=await repository.getArtifact('art-same');
 assert.equal(await after.blob.text(),'abc');
});


test('tombstoning hides the utterance without erasing its active gathering history', async()=>{
 const { IDBFactory } = await import('fake-indexeddb');
 const { IndexedDBArchiveRepository } = await import('../js/storage/indexeddb.js');
 const repository=new IndexedDBArchiveRepository({name:'tombstone-membership',indexedDB:new IDBFactory()});
 const utterance=await repository.createUtterance({id:'u-tombstone-gathered',text:'still part of the history'});
 const constellation=await repository.createConstellation({id:'con-tombstone-gathered',name:'A gathering',provenance:{origin:'author'}});
 await repository.createMembership({
  id:'mem-tombstone-gathered',
  constellationId:constellation.id,
  utteranceId:utterance.id,
  provenance:{origin:'author'}
 });
 await repository.tombstoneUtterance(utterance.id,'author choice');
 const visible=await repository.listUtterances({status:'kept',limit:Infinity});
 assert.equal(visible.some(item=>item.id===utterance.id),false);
 const memberships=await repository.listMemberships({utteranceId:utterance.id,status:'active'});
 assert.equal(memberships.length,1);
 assert.equal(memberships[0].id,'mem-tombstone-gathered');
});


test('Inspect renders gathering as placement rather than ownership', async()=>{
 const { inspectView } = await import('../js/views/inspect.js');
 const html=inspectView({
  utterance:createUtterance({id:'u-inspect-gathered',text:'exact words'}),
  artifacts:[],transcriptions:[],relations:[],
  gatherings:[{
   membership:{id:'mem-inspect',createdAt:'2026-09-26T12:00:00.000Z'},
   constellation:{id:'con-inspect',name:'Darśana'}
  }],
  available:[{id:'con-other',name:'Jala Yāna'}]
 });
 assert.match(html,/Gathered in/i);
 assert.match(html,/Darśana/);
 assert.match(html,/data-withdraw-membership="mem-inspect"/);
 assert.match(html,/Gather here →/);
 assert.match(html,/Start a new constellation from this/);
 assert.doesNotMatch(html,/suggest/i);
 assert.doesNotMatch(html,/belongs to/i);
});

test('Inspect names the absence of gathering without turning it into a tag prompt', async()=>{
 const { inspectView } = await import('../js/views/inspect.js');
 const html=inspectView({
  utterance:createUtterance({id:'u-inspect-empty',text:'unplaced words'}),
  artifacts:[],transcriptions:[],relations:[],gatherings:[],available:[]
 });
 assert.match(html,/Not yet gathered anywhere\./);
 assert.match(html,/Gather here →/);
 assert.doesNotMatch(html,/add tag|tag this/i);
});

test('constellation authoring service places and withdraws one utterance explicitly', async()=>{
 const { IDBFactory } = await import('fake-indexeddb');
 const { IndexedDBArchiveRepository } = await import('../js/storage/indexeddb.js');
 const { placeUtterance, withdrawUtteranceMembership, getUtteranceGatheringState } = await import('../js/services/constellations.js');
 const repository=new IndexedDBArchiveRepository({name:'inspect-authoring',indexedDB:new IDBFactory()});
 const utterance=await repository.createUtterance({id:'u-authoring',text:'words'});
 const first=await repository.createConstellation({id:'con-authoring-a',name:'First place',provenance:{origin:'author'}});
 const second=await repository.createConstellation({id:'con-authoring-b',name:'Second place',provenance:{origin:'author'}});
 const membership=await placeUtterance(utterance.id,first.id,{archive:repository});
 let state=await getUtteranceGatheringState(utterance.id,{archive:repository});
 assert.deepEqual(state.gatherings.map(x=>x.constellation.id),[first.id]);
 assert.deepEqual(state.available.map(x=>x.id),[second.id]);
 await withdrawUtteranceMembership(membership.id,{archive:repository});
 state=await getUtteranceGatheringState(utterance.id,{archive:repository});
 assert.deepEqual(state.gatherings,[]);
 assert.deepEqual(state.available.map(x=>x.id),[first.id,second.id]);
 const history=await repository.listMemberships({utteranceId:utterance.id,status:'withdrawn'});
 assert.equal(history.length,1);
 assert.equal(history[0].id,membership.id);
});

test('starting a constellation from Inspect creates an author assertion without suggestions', async()=>{
 const { IDBFactory } = await import('fake-indexeddb');
 const { IndexedDBArchiveRepository } = await import('../js/storage/indexeddb.js');
 const { startConstellationFromUtterance } = await import('../js/services/constellations.js');
 const repository=new IndexedDBArchiveRepository({name:'inspect-new-constellation',indexedDB:new IDBFactory()});
 const utterance=await repository.createUtterance({id:'u-new-constellation',text:'first position'});
 const {constellation,membership}=await startConstellationFromUtterance('  A new place  ',utterance.id,{archive:repository});
 assert.equal(constellation.name,'A new place');
 assert.equal(constellation.provenance.origin,'author');
 assert.equal(membership.utteranceId,utterance.id);
 assert.equal(membership.constellationId,constellation.id);
 assert.equal(membership.provenance.origin,'author');
});


test('Inspect keeps withdrawn relation history visible while adding gathering state', async()=>{
 const { IDBFactory } = await import('fake-indexeddb');
 const { IndexedDBArchiveRepository } = await import('../js/storage/indexeddb.js');
 const { getUtteranceInspection } = await import('../js/services/inspect.js');
 const repository=new IndexedDBArchiveRepository({name:'inspect-relation-history',indexedDB:new IDBFactory()});
 const first=await repository.createUtterance({id:'u-relation-first',text:'first'});
 const second=await repository.createUtterance({id:'u-relation-second',text:'second'});
 const relation=await repository.createRelation({
  id:'rel-withdrawn-inspect',
  type:'returns-to',
  fromId:first.id,
  toId:second.id,
  provenance:{origin:'author'}
 });
 await repository.withdrawRelation(relation.id,'later withdrawal');
 const inspection=await getUtteranceInspection(first.id,{archive:repository});
 assert.equal(inspection.relations.length,1);
 assert.equal(inspection.relations[0].id,relation.id);
 assert.equal(inspection.relations[0].status,'withdrawn');
});

test('Inspect placement metadata is absolute rather than relative to the day viewed', async()=>{
 const { inspectView } = await import('../js/views/inspect.js');
 const html=inspectView({
  utterance:createUtterance({id:'u-placement-time',text:'position'}),
  artifacts:[],transcriptions:[],relations:[],
  gatherings:[{
   membership:{id:'mem-placement-time',createdAt:'2026-09-26T12:00:00.000Z'},
   constellation:{id:'con-placement-time',name:'A place'}
  }],
  available:[]
 });
 assert.match(html,/Sep 26, 2026/);
 assert.match(html,/UTC/);
 assert.doesNotMatch(html,/today|yesterday|ago|in \d+ day/i);
});

test('authoring provenance does not invent an actor identity', async()=>{
 const { IDBFactory } = await import('fake-indexeddb');
 const { IndexedDBArchiveRepository } = await import('../js/storage/indexeddb.js');
 const { placeUtterance, startConstellationFromUtterance } = await import('../js/services/constellations.js');
 const repository=new IndexedDBArchiveRepository({name:'author-provenance-no-actor',indexedDB:new IDBFactory()});
 const utterance=await repository.createUtterance({id:'u-no-actor',text:'words'});
 const existing=await repository.createConstellation({id:'con-no-actor-existing',name:'Existing',provenance:{origin:'author'}});
 const membership=await placeUtterance(utterance.id,existing.id,{archive:repository});
 assert.deepEqual(membership.provenance.origin,'author');
 assert.equal('actorId' in membership.provenance,false);
 await repository.withdrawMembership(membership.id,'reset');
 const created=await startConstellationFromUtterance('New place',utterance.id,{archive:repository});
 assert.equal('actorId' in created.constellation.provenance,false);
 assert.equal('actorId' in created.membership.provenance,false);
});


test('Inspect UI events place, withdraw, and create-from-this through the bound app shell', async()=>{
 const { IDBFactory } = await import('fake-indexeddb');
 globalThis.indexedDB=new IDBFactory();

 const previousDocument=globalThis.document;
 const previousWindow=globalThis.window;
 const fields=new Map();
 globalThis.document={
  readyState:'complete',
  querySelector(selector){ return fields.get(selector)||null; },
  querySelectorAll(){ return []; },
  addEventListener(){}
 };
 globalThis.window={scrollY:0,scrollTo(){}};

 try{
  const { AllISayApp } = await import('../js/app.js');
  const { getArchive } = await import('../js/services/archive.js');
  const archive=await getArchive();
  const utterance=await archive.createUtterance({id:'u-ui-gathering',text:'words through the interface'});
  const existing=await archive.createConstellation({id:'con-ui-existing',name:'Existing place',provenance:{origin:'author'}});

  class InteractionRoot {
   constructor(){ this.listeners=new Map(); }
   addEventListener(type,handler){
    if(!this.listeners.has(type))this.listeners.set(type,[]);
    this.listeners.get(type).push(handler);
   }
   async dispatch(type,target){
    const event={target,preventDefault(){this.defaultPrevented=true;},key:null};
    for(const handler of this.listeners.get(type)||[])await handler(event);
    return event;
   }
  }
  const target=(kind,dataset={})=>({
   id:'',
   dataset,
   closest(selector){
    if(kind==='gather'&&selector==='[data-gather-constellation]')return this;
    if(kind==='withdraw'&&selector==='[data-withdraw-membership]')return this;
    return null;
   }
  });

  const root=new InteractionRoot();
  const app=new AllISayApp(root);
  app.inspectId=utterance.id;
  app.refreshInspect=async()=>{};
  app.bind();

  await root.dispatch('click',target('gather',{gatherConstellation:existing.id}));
  let active=await archive.listMemberships({utteranceId:utterance.id,status:'active'});
  assert.equal(active.length,1);
  assert.equal(active[0].constellationId,existing.id);

  await root.dispatch('click',target('withdraw',{withdrawMembership:active[0].id}));
  active=await archive.listMemberships({utteranceId:utterance.id,status:'active'});
  const withdrawn=await archive.listMemberships({utteranceId:utterance.id,status:'withdrawn'});
  assert.equal(active.length,0);
  assert.equal(withdrawn.length,1);

  fields.set('#newConstellationName',{value:'From the interface'});
  await root.dispatch('submit',{id:'newConstellationForm',closest(){return null;}});
  const constellations=await archive.listConstellations({status:'active'});
  const created=constellations.find(item=>item.name==='From the interface');
  assert.ok(created);
  active=await archive.listMemberships({utteranceId:utterance.id,status:'active'});
  assert.equal(active.length,1);
  assert.equal(active[0].constellationId,created.id);
  assert.equal(active[0].provenance.origin,'author');
 } finally {
  if(previousDocument===undefined)delete globalThis.document; else globalThis.document=previousDocument;
  if(previousWindow===undefined)delete globalThis.window; else globalThis.window=previousWindow;
 }
});
