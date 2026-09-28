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


test('create-from-this is atomic when the target utterance does not exist', async()=>{
 const { IDBFactory } = await import('fake-indexeddb');
 const { IndexedDBArchiveRepository } = await import('../js/storage/indexeddb.js');
 const { startConstellationFromUtterance } = await import('../js/services/constellations.js');
 const repository=new IndexedDBArchiveRepository({name:'atomic-start-constellation',indexedDB:new IDBFactory()});
 await assert.rejects(
  ()=>startConstellationFromUtterance('Must not remain','missing-utterance',{archive:repository}),
  /Unknown utterance/
 );
 assert.deepEqual(await repository.listConstellations({status:undefined}),[]);
 assert.deepEqual(await repository.listMemberships({status:undefined}),[]);
});


test('Search sees constellation names and aliases without turning them into utterance text', async()=>{
 const { searchConstellations } = await import('../js/services/search.js');
 const constellations=[
  {id:'con-search-a',name:'Darśana',aliases:['Clear Sight'],description:'seeing',createdAt:'2026-01-01T00:00:00.000Z'},
  {id:'con-search-b',name:'Undir Sólu',aliases:['Under the Sun'],description:'consequence',createdAt:'2026-02-01T00:00:00.000Z'}
 ];
 const archive={async listConstellations(){return constellations;}};
 assert.deepEqual((await searchConstellations('clear',{archive})).map(x=>x.id),['con-search-a']);
 assert.deepEqual((await searchConstellations('under the sun',{archive})).map(x=>x.id),['con-search-b']);
 assert.deepEqual((await searchConstellations('consequence',{archive})).map(x=>x.id),['con-search-b']);
});

test('Search renders first-class constellation results as Places, not word matches', async()=>{
 const { AllISayApp } = await import('../js/app.js');
 const app=new AllISayApp({addEventListener(){}});
 const html=app.searchMarkup({
  utterances:[],
  constellations:[{id:'con-search-view',name:'A Place'}]
 },'place');
 assert.match(html,/data-search-constellation="con-search-view"/);
 assert.match(html,/Constellation/);
 assert.match(html,/A Place/);
 assert.doesNotMatch(html,/data-entry-id="con-search-view"/);
});


test('Search constellation result opens its first-class Place through bound UI events', async()=>{
 const { AllISayApp } = await import('../js/app.js');
 class Root {
  constructor(){this.listeners=new Map();}
  addEventListener(type,handler){
   if(!this.listeners.has(type))this.listeners.set(type,[]);
   this.listeners.get(type).push(handler);
  }
  async dispatch(type,target){
   const event={target,preventDefault(){},key:null};
   for(const handler of this.listeners.get(type)||[])await handler(event);
  }
 }
 const root=new Root();
 const app=new AllISayApp(root);
 let opened=null;
 app.openSearchConstellation=async id=>{opened=id;};
 app.bind();
 const target={
  id:'',
  dataset:{searchConstellation:'con-search-click'},
  closest(selector){return selector==='[data-search-constellation]'?this:null;}
 };
 await root.dispatch('click',target);
 assert.equal(opened,'con-search-click');
});


test('derived archive records never silently claim author provenance', async()=>{
 const { createAnnotation } = await import('../js/domain/annotation.js');
 const { createInterpretation } = await import('../js/domain/interpretation.js');
 assert.throws(()=>createAnnotation({targetId:'u-derived',text:'a note'}),/provenance.origin is required/);
 assert.throws(()=>createInterpretation({targetId:'u-derived',reading:'a reading'}),/provenance.origin is required/);
 const annotation=createAnnotation({targetId:'u-derived',text:'a note',provenance:{origin:'author'}});
 const interpretation=createInterpretation({targetId:'u-derived',reading:'a reading',provenance:{origin:'author'}});
 assert.equal(annotation.provenance.origin,'author');
 assert.equal(interpretation.provenance.origin,'author');
});

test('Suggestions require explicit provenance and AI provenance names its model', async()=>{
 const { createSuggestion } = await import('../js/domain/suggestion.js');
 assert.throws(()=>createSuggestion({kind:'relation',payload:{}}),/provenance.origin is required/);
 assert.throws(
  ()=>createSuggestion({kind:'relation',payload:{},provenance:{origin:'ai'}}),
  /provenance.model/
 );
 const suggestion=createSuggestion({
  kind:'relation',
  payload:{fromId:'u-one',toId:'u-two'},
  provenance:{origin:'ai',model:'test-model'}
 });
 assert.equal(suggestion.status,'pending');
 assert.equal(suggestion.provenance.origin,'ai');
 assert.equal(suggestion.provenance.model,'test-model');
});


test('IndexedDB persists annotations and interpretations beside, not inside, utterances', async()=>{
 const { IDBFactory } = await import('fake-indexeddb');
 const { IndexedDBArchiveRepository } = await import('../js/storage/indexeddb.js');
 const repository=new IndexedDBArchiveRepository({name:'secondary-records',indexedDB:new IDBFactory()});
 const utterance=await repository.createUtterance({id:'u-secondary',text:'the record stays itself'});
 const relationTarget=await repository.createUtterance({id:'u-secondary-other',text:'another position'});
 const relation=await repository.createRelation({
  id:'rel-secondary',
  type:'returns-to',
  fromId:utterance.id,
  toId:relationTarget.id,
  provenance:{origin:'author'}
 });
 await repository.createAnnotation({
  id:'ann-secondary',
  targetId:utterance.id,
  text:'context beside the words',
  provenance:{origin:'author'}
 });
 await repository.createInterpretation({
  id:'int-secondary',
  targetId:utterance.id,
  reading:'a dated reading of the words',
  relationIds:[relation.id],
  provenance:{origin:'author'}
 });
 assert.equal((await repository.getUtterance(utterance.id)).text,'the record stays itself');
 assert.deepEqual((await repository.listAnnotations({targetId:utterance.id})).map(x=>x.id),['ann-secondary']);
 assert.deepEqual((await repository.listInterpretations({targetId:utterance.id})).map(x=>x.id),['int-secondary']);
});

test('secondary canonical records cannot point at absent archive evidence', async()=>{
 const { IDBFactory } = await import('fake-indexeddb');
 const { IndexedDBArchiveRepository } = await import('../js/storage/indexeddb.js');
 const repository=new IndexedDBArchiveRepository({name:'secondary-references',indexedDB:new IDBFactory()});
 await assert.rejects(
  ()=>repository.createAnnotation({targetId:'missing',text:'note',provenance:{origin:'author'}}),
  /Unknown utterance/
 );
 await assert.rejects(
  ()=>repository.createInterpretation({targetId:'missing',reading:'reading',provenance:{origin:'author'}}),
  /Unknown utterance/
 );
 const utterance=await repository.createUtterance({id:'u-interpretation-reference',text:'present'});
 await assert.rejects(
  ()=>repository.createInterpretation({
   targetId:utterance.id,
   reading:'reading',
   relationIds:['missing-relation'],
   provenance:{origin:'author'}
  }),
  /Unknown relation/
 );
});

test('Suggestions persist as pending proposals without becoming canonical records', async()=>{
 const { IDBFactory } = await import('fake-indexeddb');
 const { IndexedDBArchiveRepository } = await import('../js/storage/indexeddb.js');
 const repository=new IndexedDBArchiveRepository({name:'suggestion-store',indexedDB:new IDBFactory()});
 await repository.createSuggestion({
  id:'sug-pending',
  kind:'relation',
  payload:{fromId:'u-one',toId:'u-two'},
  provenance:{origin:'ai',model:'test-model'}
 });
 const pending=await repository.listSuggestions({status:'pending'});
 assert.equal(pending.length,1);
 assert.equal(pending[0].id,'sug-pending');
 assert.deepEqual(await repository.listRelations({status:undefined}),[]);
});

test('portable format 4 validates secondary records and older formats default them empty', async()=>{
 const { validateImportPayload } = await import('../js/storage/import.js');
 const utterance=createUtterance({id:'u-portable-secondary',text:'portable'});
 const base={utterances:[utterance],artifacts:[],transcriptions:[],relations:[],constellations:[],memberships:[]};
 const old=validateImportPayload({exportFormatVersion:3,...base});
 assert.deepEqual(old.annotations,[]);
 assert.deepEqual(old.interpretations,[]);
 assert.deepEqual(old.suggestions,[]);

 const { createAnnotation } = await import('../js/domain/annotation.js');
 const { createInterpretation } = await import('../js/domain/interpretation.js');
 const { createSuggestion } = await import('../js/domain/suggestion.js');
 const current=validateImportPayload({
  exportFormatVersion:4,
  ...base,
  annotations:[createAnnotation({id:'ann-portable',targetId:utterance.id,text:'note',provenance:{origin:'author'}})],
  interpretations:[createInterpretation({id:'int-portable',targetId:utterance.id,reading:'reading',provenance:{origin:'author'}})],
  suggestions:[createSuggestion({id:'sug-portable',kind:'relation',payload:{},provenance:{origin:'ai',model:'test-model'}})]
 });
 assert.equal(current.annotations.length,1);
 assert.equal(current.interpretations.length,1);
 assert.equal(current.suggestions.length,1);
});


test('dangling secondary record aborts the whole repository import', async()=>{
 const { IDBFactory } = await import('fake-indexeddb');
 const { IndexedDBArchiveRepository } = await import('../js/storage/indexeddb.js');
 const { createAnnotation } = await import('../js/domain/annotation.js');
 const repository=new IndexedDBArchiveRepository({name:'secondary-import-atomicity',indexedDB:new IDBFactory()});
 const utterance=createUtterance({id:'u-secondary-import',text:'must not partially land'});
 const annotation=createAnnotation({
  id:'ann-dangling-import',
  targetId:'missing-target',
  text:'cannot float free',
  provenance:{origin:'author'}
 });
 await assert.rejects(
  ()=>repository.importAll({
   utterances:[utterance],
   artifacts:[],transcriptions:[],relations:[],constellations:[],memberships:[],
   annotations:[annotation],interpretations:[],suggestions:[]
  }),
  /missing utterance/
 );
 assert.equal(await repository.getUtterance(utterance.id),undefined);
 assert.deepEqual(await repository.listAnnotations({}),[]);
});


test('Inspect encounters later readings without changing the utterance', async()=>{
 const { IDBFactory } = await import('fake-indexeddb');
 const { IndexedDBArchiveRepository } = await import('../js/storage/indexeddb.js');
 const { addAnnotation, addInterpretation } = await import('../js/services/readings.js');
 const { getUtteranceInspection } = await import('../js/services/inspect.js');
 const repository=new IndexedDBArchiveRepository({name:'inspect-readings',indexedDB:new IDBFactory()});
 const utterance=await repository.createUtterance({id:'u-readings-inspect',text:'first light'});
 await addAnnotation(utterance.id,'said before I had the later words',{archive:repository});
 await addInterpretation(utterance.id,'I read this differently now',{archive:repository});
 const inspection=await getUtteranceInspection(utterance.id,{archive:repository});
 assert.equal(inspection.utterance.text,'first light');
 assert.equal(inspection.annotations[0].text,'said before I had the later words');
 assert.equal(inspection.interpretations[0].reading,'I read this differently now');
 assert.equal(inspection.annotations[0].provenance.origin,'author');
 assert.equal(inspection.interpretations[0].provenance.origin,'author');
});

test('Inspect visually names later readings as beside the words', async()=>{
 const { inspectView } = await import('../js/views/inspect.js');
 const html=inspectView({
  utterance:createUtterance({id:'u-reading-view',text:'the original position'}),
  artifacts:[],transcriptions:[],relations:[],gatherings:[],available:[],
  annotations:[{id:'ann-view',targetId:'u-reading-view',targetType:'utterance',text:'later context',createdAt:'2026-09-27T20:00:00.000Z',provenance:{origin:'author'}}],
  interpretations:[{id:'int-view',targetId:'u-reading-view',reading:'later meaning',createdAt:'2026-09-28T20:00:00.000Z',provenance:{origin:'author'},relationIds:[]}]
 });
 assert.match(html,/Beside these words/);
 assert.match(html,/Later readings remain separate from the utterance/);
 assert.match(html,/later context/);
 assert.match(html,/later meaning/);
 assert.match(html,/your later note/);
 assert.match(html,/This does not alter the utterance above/);
 assert.match(html,/id="annotationForm"/);
 assert.match(html,/id="interpretationForm"/);
 assert.ok(html.indexOf('the original position') < html.indexOf('later context'));
});

test('bound Inspect forms keep author readings through the actual event shell', async()=>{
 const previousDocument=globalThis.document;
 const fields=new Map();
 globalThis.document={
  readyState:'complete',
  querySelector(selector){ return fields.get(selector)||null; },
  querySelectorAll(){ return []; },
  addEventListener(){}
 };
 try{
  const { AllISayApp } = await import('../js/app.js');
  const { getArchive } = await import('../js/services/archive.js');
  const archive=await getArchive();
  const utterance=await archive.createUtterance({id:'u-ui-reading',text:'record remains primary'});

  class Root {
   constructor(){this.listeners=new Map();}
   addEventListener(type,handler){
    if(!this.listeners.has(type))this.listeners.set(type,[]);
    this.listeners.get(type).push(handler);
   }
   async dispatch(type,target){
    const event={target,preventDefault(){this.defaultPrevented=true;},key:null};
    for(const handler of this.listeners.get(type)||[])await handler(event);
   }
  }

  const root=new Root();
  const app=new AllISayApp(root);
  app.inspectId=utterance.id;
  app.refreshInspect=async()=>{};
  app.bind();

  fields.set('#annotationText',{value:'context from later'});
  await root.dispatch('submit',{id:'annotationForm',closest(){return null;}});
  fields.set('#interpretationText',{value:'meaning from later'});
  await root.dispatch('submit',{id:'interpretationForm',closest(){return null;}});

  const annotations=await archive.listAnnotations({targetId:utterance.id});
  const interpretations=await archive.listInterpretations({targetId:utterance.id});
  assert.equal(annotations.at(-1).text,'context from later');
  assert.equal(interpretations.at(-1).reading,'meaning from later');
  assert.equal(annotations.at(-1).provenance.origin,'author');
  assert.equal(interpretations.at(-1).provenance.origin,'author');
  assert.equal((await archive.getUtterance(utterance.id)).text,'record remains primary');
 } finally {
  if(previousDocument===undefined)delete globalThis.document; else globalThis.document=previousDocument;
 }
});


test('AI gateway can only leave a pending proposal, never a canonical relation', async()=>{
 const { IDBFactory } = await import('fake-indexeddb');
 const { IndexedDBArchiveRepository } = await import('../js/storage/indexeddb.js');
 const { proposeRelation } = await import('../js/services/ai/aiGateway.js');
 const repository=new IndexedDBArchiveRepository({name:'ai-gateway-pending-only',indexedDB:new IDBFactory()});
 const from=await repository.createUtterance({id:'u-ai-from',text:'earlier'});
 const to=await repository.createUtterance({id:'u-ai-to',text:'later'});
 const suggestion=await proposeRelation({
  type:'develops',fromId:from.id,toId:to.id,note:'possible movement'
 },{model:'test-model',confidence:.72,archive:repository});
 assert.equal(suggestion.status,'pending');
 assert.equal(suggestion.provenance.origin,'ai');
 assert.equal(suggestion.provenance.model,'test-model');
 assert.equal(suggestion.decision,null);
 assert.deepEqual(await repository.listRelations({status:undefined}),[]);
});

test('accepting a relation proposal atomically records author decision and canonical provenance', async()=>{
 const { IDBFactory } = await import('fake-indexeddb');
 const { IndexedDBArchiveRepository } = await import('../js/storage/indexeddb.js');
 const { proposeRelation } = await import('../js/services/ai/aiGateway.js');
 const repository=new IndexedDBArchiveRepository({name:'accept-proposal',indexedDB:new IDBFactory()});
 const from=await repository.createUtterance({id:'u-accept-from',text:'one'});
 const to=await repository.createUtterance({id:'u-accept-to',text:'two'});
 const proposal=await proposeRelation({type:'returns-to',fromId:from.id,toId:to.id},{model:'test-model',confidence:.61,archive:repository});
 const {suggestion,relation}=await repository.acceptRelationSuggestion(proposal.id);
 assert.equal(suggestion.status,'accepted');
 assert.equal(suggestion.decision.status,'accepted');
 assert.equal(suggestion.decision.provenance.origin,'author');
 assert.equal(suggestion.decision.canonicalEntityId,relation.id);
 assert.equal(relation.provenance.origin,'author');
 assert.equal(relation.provenance.model,null);
 assert.equal(relation.provenance.suggestionId,proposal.id);
 assert.equal((await repository.listRelations({status:'active'})).length,1);
 await assert.rejects(()=>repository.acceptRelationSuggestion(proposal.id),/already accepted/);
 assert.equal((await repository.listRelations({status:'active'})).length,1);
});

test('rejecting a proposal records the decision without creating canonical structure', async()=>{
 const { IDBFactory } = await import('fake-indexeddb');
 const { IndexedDBArchiveRepository } = await import('../js/storage/indexeddb.js');
 const { proposeRelation } = await import('../js/services/ai/aiGateway.js');
 const repository=new IndexedDBArchiveRepository({name:'reject-proposal',indexedDB:new IDBFactory()});
 const from=await repository.createUtterance({id:'u-reject-from',text:'one'});
 const to=await repository.createUtterance({id:'u-reject-to',text:'two'});
 const proposal=await proposeRelation({type:'contradicts',fromId:from.id,toId:to.id},{model:'test-model',confidence:.8,archive:repository});
 const rejected=await repository.rejectSuggestion(proposal.id);
 assert.equal(rejected.status,'rejected');
 assert.equal(rejected.decision.provenance.origin,'author');
 assert.equal(rejected.decision.canonicalEntityId,null);
 assert.deepEqual(await repository.listRelations({status:undefined}),[]);
});

test('canonical relations cannot silently claim author provenance or unknown types', async()=>{
 const { createRelation } = await import('../js/domain/relation.js');
 assert.throws(()=>createRelation({type:'develops',fromId:'a',toId:'b'}),/provenance.origin is required/);
 assert.throws(()=>createRelation({type:'invented-relation',fromId:'a',toId:'b',provenance:{origin:'author'}}),/relation.type is invalid/);
});

test('Inspect keeps pending machine proposals outside Relations until accepted', async()=>{
 const { inspectView } = await import('../js/views/inspect.js');
 const html=inspectView({
  utterance:createUtterance({id:'u-proposal-view',text:'the record'}),
  artifacts:[],transcriptions:[],relations:[],gatherings:[],available:[],annotations:[],interpretations:[],
  pendingSuggestions:[{
   suggestion:{
    id:'sug-view',kind:'relation',status:'pending',
    payload:{type:'develops',fromId:'u-proposal-view',toId:'u-other'},
    provenance:{origin:'ai',model:'test-model',confidence:.75}
   },
   currentId:'u-proposal-view',
   otherUtterance:createUtterance({id:'u-other',text:'another position'})
  }]
 });
 assert.match(html,/Pending machine proposal/);
 assert.match(html,/A machine proposal is not a relation unless you accept it/);
 assert.match(html,/Accept as relation/);
 assert.match(html,/data-reject-suggestion="sug-view"/);
 assert.match(html,/another position/);
 assert.match(html,/these words → referenced words/);
 const proposalIndex=html.indexOf('Pending machine proposal');
 const relationsIndex=html.lastIndexOf('<h2>Relations</h2>');
 assert.ok(proposalIndex < relationsIndex);
});

test('bound proposal decisions require the explicit Inspect action', async()=>{
 const previousDocument=globalThis.document;
 globalThis.document={readyState:'complete',querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){}};
 try{
  const { AllISayApp } = await import('../js/app.js');
  const { getArchive } = await import('../js/services/archive.js');
  const { proposeRelation } = await import('../js/services/ai/aiGateway.js');
  const archive=await getArchive();
  const from=await archive.createUtterance({id:'u-ui-proposal-from',text:'one'});
  const to=await archive.createUtterance({id:'u-ui-proposal-to',text:'two'});
  const accept=await proposeRelation({type:'continues',fromId:from.id,toId:to.id},{model:'test-model',confidence:.7,archive});
  const reject=await proposeRelation({type:'similar-to',fromId:from.id,toId:to.id},{model:'test-model',confidence:.6,archive});

  class Root{
   constructor(){this.listeners=new Map();}
   addEventListener(type,handler){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(handler);}
   async dispatch(type,target){const event={target,preventDefault(){},key:null};for(const handler of this.listeners.get(type)||[])await handler(event);}
  }
  const target=(kind,id)=>({
   id:'',dataset:kind==='accept'?{acceptSuggestion:id}:{rejectSuggestion:id},
   closest(selector){
    if(kind==='accept'&&selector==='[data-accept-suggestion]')return this;
    if(kind==='reject'&&selector==='[data-reject-suggestion]')return this;
    return null;
   }
  });
  const root=new Root(),app=new AllISayApp(root);
  app.inspectId=from.id;app.refreshInspect=async()=>{};app.bind();
  assert.deepEqual(await archive.listRelations({status:undefined}),[]);
  await root.dispatch('click',target('accept',accept.id));
  assert.equal((await archive.getSuggestion(accept.id)).status,'accepted');
  assert.equal((await archive.listRelations({status:'active'})).length,1);
  await root.dispatch('click',target('reject',reject.id));
  assert.equal((await archive.getSuggestion(reject.id)).status,'rejected');
  assert.equal((await archive.listRelations({status:'active'})).length,1);
 } finally {
  if(previousDocument===undefined)delete globalThis.document; else globalThis.document=previousDocument;
 }
});


test('proposal review shows direction from the inspected position before acceptance', async()=>{
 const { inspectView } = await import('../js/views/inspect.js');
 const current=createUtterance({id:'u-direction-current',text:'current position'});
 const other=createUtterance({id:'u-direction-other',text:'earlier position'});
 const html=inspectView({
  utterance:current,
  artifacts:[],transcriptions:[],relations:[],gatherings:[],available:[],annotations:[],interpretations:[],
  pendingSuggestions:[{
   suggestion:{
    id:'sug-direction',kind:'relation',status:'pending',
    payload:{type:'responds-to',fromId:other.id,toId:current.id,directional:true},
    provenance:{origin:'ai',model:'test-model',confidence:.66}
   },
   currentId:current.id,
   otherUtterance:other
  }]
 });
 assert.match(html,/referenced words → these words/);
 assert.doesNotMatch(html,/these words → referenced words/);
});


test('proposal direction is visible from either inspected position', async()=>{
 const { inspectView } = await import('../js/views/inspect.js');
 const current=createUtterance({id:'u-direction-current',text:'current position'});
 const other=createUtterance({id:'u-direction-other',text:'earlier position'});
 const html=inspectView({
  utterance:current,
  artifacts:[],transcriptions:[],relations:[],gatherings:[],available:[],annotations:[],interpretations:[],
  pendingSuggestions:[{
   suggestion:{id:'sug-direction',kind:'relation',status:'pending',payload:{type:'responds-to',fromId:other.id,toId:current.id,directional:true},provenance:{origin:'ai',model:'test-model',confidence:.5}},
   otherUtterance:other,
   currentId:current.id
  }]
 });
 assert.match(html,/referenced words → these words/);
 assert.doesNotMatch(html,/these words → referenced words/);
});
