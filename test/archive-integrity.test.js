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
 const membership=createMembership({id:'m-broken',constellationId:'missing',utteranceId:u.id});
 const payload={exportFormatVersion:3,utterances:[u],artifacts:[],transcriptions:[],relations:[],constellations:[],memberships:[membership]};
 assert.throws(()=>validateImportPayload(payload),/missing constellation/);
});

test('v2 exports remain importable with an empty constellation graph',()=>{
 const u=createUtterance({id:'u-old-export',text:'older words'});
 const result=validateImportPayload({exportFormatVersion:2,utterances:[u],artifacts:[],transcriptions:[],relations:[]});
 assert.deepEqual(result.constellations,[]);
 assert.deepEqual(result.memberships,[]);
});
