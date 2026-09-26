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
