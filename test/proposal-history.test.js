import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDBArchiveRepository } from '../js/storage/indexeddb.js';
import { proposeRelation } from '../js/services/ai/aiGateway.js';
import { getUtteranceInspection } from '../js/services/inspect.js';
import { inspectView } from '../js/views/inspect.js';
import { exportAll } from '../js/storage/export.js';
import { importAll, validateImportPayload } from '../js/storage/import.js';

const archive=()=>new IndexedDBArchiveRepository({name:'history',indexedDB:new IDBFactory()});
async function fixture(){
  const repository=archive();
  const from=await repository.createUtterance({id:'from',text:'line one\n  line two <exact>'});
  const to=await repository.createUtterance({id:'to',text:'other exact words'});
  const propose=()=>proposeRelation({fromId:from.id,toId:to.id,type:'continues',directional:false,note:'a possible return'}, {archive:repository,model:'test-model',confidence:.5});
  const accepted=await repository.acceptRelationSuggestion((await propose()).id);
  const rejected=await repository.rejectSuggestion((await propose()).id,'my <reason>\nleft as written');
  const pending=await propose();
  return {repository,from,to,accepted,rejected,pending};
}

test('Inspect retains decisions, original words, and bidirectional source traces after withdrawal',async()=>{
  const {repository,from,to,accepted,rejected,pending}=await fixture();
  await repository.withdrawRelation(accepted.relation.id,'later withdrawn');
  for(const id of [from.id,to.id]){
    const inspection=await getUtteranceInspection(id,{archive:repository});
    assert.deepEqual(inspection.pendingSuggestions.map(x=>x.suggestion.id),[pending.id]);
    assert.equal(inspection.proposalHistory.length,2);
    const trace=inspection.proposalHistory.find(x=>x.suggestion.id===accepted.suggestion.id);
    assert.equal(trace.canonicalRelation.status,'withdrawn');
    assert.equal(trace.otherUtterance.text,id===from.id?to.text:from.text);
    const html=inspectView(inspection);
    const history=html.slice(html.indexOf('<h2>Proposal history</h2>'));
    assert.match(history,/Accepted by you/);
    assert.match(history,/Rejected by you/);
    assert.match(history,/my &lt;reason&gt;\nleft as written/);
    assert.match(history,/these words ↔ referenced words/);
    assert.match(history,/50% model confidence/);
    assert.match(history,/View author Relation · withdrawn/);
    assert.ok(history.includes('href="#relation-'+accepted.relation.id+'"'));
    assert.ok(history.includes('href="#proposal-'+accepted.suggestion.id+'"'));
    assert.doesNotMatch(history,/data-accept-suggestion|data-reject-suggestion/);
  }
  assert.equal((await repository.getUtterance(from.id)).text,from.text);
  assert.deepEqual((await repository.getSuggestion(rejected.id)).provenance,rejected.provenance);
});

test('export and import preserve all proposal decisions, withdrawn links, and tombstoned evidence',async()=>{
  const {repository,from,accepted,rejected,pending}=await fixture();
  const withdrawn=await repository.withdrawRelation(accepted.relation.id,'no longer asserted');
  const tombstone=await repository.tombstoneUtterance(from.id,'kept as history');
  const payload=await exportAll(repository);
  assert.equal(payload.suggestions.length,3);
  assert.equal(payload.relations.length,1);
  assert.equal(payload.utterances.length,2);
  assert.equal((await repository.listSuggestions()).length,1);
  assert.equal((await repository.listRelations()).length,0);
  assert.equal((await repository.listUtterances()).length,1);
  const restored=archive();
  await importAll(restored,payload);
  assert.deepEqual(await restored.getRelation(withdrawn.id),withdrawn);
  assert.deepEqual(await restored.getUtterance(from.id),tombstone);
  for(const value of [accepted.suggestion,rejected,pending])assert.deepEqual(await restored.getSuggestion(value.id),value);
  const inspection=await getUtteranceInspection(from.id,{archive:restored});
  assert.equal(inspection.proposalHistory.length,2);
});

test('all-status export also preserves retired Places and withdrawn placements',async()=>{
  const repository=archive();
  const u=await repository.createUtterance({id:'u',text:'fixture'});
  const c=await repository.createConstellation({id:'c',name:'Fixture place',status:'retired',provenance:{origin:'author'}});
  const m=await repository.createMembership({id:'m',utteranceId:u.id,constellationId:c.id,provenance:{origin:'author'}});
  const withdrawn=await repository.withdrawMembership(m.id,'moved on');
  const payload=await exportAll(repository);
  assert.deepEqual(payload.constellations,[c]);
  assert.deepEqual(payload.memberships,[withdrawn]);
  const restored=archive();await importAll(restored,payload);
  assert.deepEqual(await restored.listMemberships({status:undefined}),[withdrawn]);
});

test('portable validation rejects mismatched accepted connections in both directions',async()=>{
  const {repository}=await fixture();
  const payload=await exportAll(repository);
  for(const change of [
    p=>p.relations[0].fromId='to',
    p=>p.relations[0].toId='from',
    p=>p.relations[0].type='contradicts',
    p=>p.relations[0].directional=true,
    p=>p.relations[0].provenance.origin='external',
    p=>p.relations[0].provenance.model='copied-model',
    p=>p.relations[0].provenance.confidence=.5,
    p=>p.relations[0].provenance.suggestionId='unrelated',
    p=>p.suggestions.find(x=>x.status==='accepted').decision.canonicalEntityId='missing',
    p=>p.suggestions=p.suggestions.filter(x=>x.status!=='accepted')
  ]){
    const bad=structuredClone(payload);change(bad);
    assert.throws(()=>validateImportPayload(bad),/canonical relation|accepted relation Suggestion/);
    await assert.rejects(()=>importAll(archive(),bad,{dryRun:true}),/canonical relation|accepted relation Suggestion/);
  }
});

test('atomic repository import rejects a mismatched connection without writing unrelated records',async()=>{
  const {repository}=await fixture();
  const normalized=validateImportPayload(await exportAll(repository));
  const bad=structuredClone(normalized);
  bad.relations[0].directional=true;
  const target=archive();
  await assert.rejects(()=>target.importAll(bad),/does not match/);
  assert.deepEqual(await target.listUtterances({status:undefined}),[]);
  assert.deepEqual(await target.listRelations({status:undefined}),[]);
  assert.deepEqual(await target.listSuggestions({status:undefined}),[]);
});

test('partial imports resolve full existing records before validating a source trace',async()=>{
  const {repository,accepted}=await fixture();
  const full=await exportAll(repository);
  const suggestionsOnly={...full,utterances:[],relations:[],suggestions:[accepted.suggestion]};
  const result=await importAll(repository,suggestionsOnly,{conflict:'skip'});
  assert.equal(result.skipped.suggestions,1);
  const relationOnly={...full,utterances:[],suggestions:[],relations:[accepted.relation]};
  const reverse=await importAll(repository,relationOnly,{conflict:'skip'});
  assert.equal(reverse.skipped.relations,1);
  const bad=structuredClone(suggestionsOnly);
  bad.suggestions[0].payload.directional=true;
  await assert.rejects(()=>importAll(repository,bad,{dryRun:true}),/does not match/);
});

test('direct Relation creation cannot forge a Suggestion source trace',async()=>{
  const {repository,accepted}=await fixture();
  await assert.rejects(()=>repository.createRelation({...accepted.relation,id:'forged'}),/through author acceptance/);
  assert.equal((await repository.listRelations()).length,1);
});

test('bound Accept and Reject actions refresh Inspect into preserved decision history',async()=>{
  const priorDocument=globalThis.document,priorIndexedDB=globalThis.indexedDB;
  const mount={innerHTML:''},error={textContent:''};
  globalThis.indexedDB=new IDBFactory();
  globalThis.document={readyState:'complete',querySelector(selector){return selector==='#inspectMount'?mount:selector==='#proposalError'?error:null;}};
  try{
    const {AllISayApp}=await import('../js/app.js');
    const {getArchive}=await import('../js/services/archive.js');
    const repository=await getArchive();
    await repository.createUtterance({id:'action-from',text:'exact\nwords'});
    await repository.createUtterance({id:'action-to',text:'later words'});
    const proposal=()=>proposeRelation({fromId:'action-from',toId:'action-to',type:'continues'},{archive:repository,model:'test-model',confidence:.5});
    const accept=await proposal(),reject=await proposal();
    const listeners=new Map();
    const app=new AllISayApp({addEventListener(type,fn){listeners.set(type,fn);}});
    app.inspectId='action-from';app.bind();
    await app.refreshInspect();
    assert.match(mount.innerHTML,/No proposal decisions yet/);
    for(const [attribute,id] of [['accept',accept.id],['reject',reject.id]]){
      await listeners.get('click')({target:{id:'',closest(selector){
        return selector==='[data-'+attribute+'-suggestion]'?{dataset:{[attribute+'Suggestion']:id}}:null;
      }}});
    }
    assert.equal(error.textContent,'');
    assert.match(mount.innerHTML,/Accepted by you/);
    assert.match(mount.innerHTML,/Rejected by you/);
    assert.doesNotMatch(mount.innerHTML,/data-accept-suggestion|data-reject-suggestion/);
    assert.equal((await repository.listRelations()).length,1);
    assert.equal((await repository.getUtterance('action-from')).text,'exact\nwords');
  }finally{
    if(priorDocument===undefined)delete globalThis.document;else globalThis.document=priorDocument;
    if(priorIndexedDB===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=priorIndexedDB;
  }
});
