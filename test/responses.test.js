import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { IndexedDBArchiveRepository } from '../js/storage/indexeddb.js';
import { respondToUtterance } from '../js/services/responses.js';
import { getUtteranceInspection } from '../js/services/inspect.js';
import { exportAll } from '../js/storage/export.js';
import { importAll } from '../js/storage/import.js';

const repository=()=>new IndexedDBArchiveRepository({name:'responses-'+crypto.randomUUID()});
const provenance={origin:'author'};
test('recursive responses preserve exact words, author direction and portable connections',async()=>{
 const archive=repository(),original=await archive.createUtterance({text:' First words. '});
 const first=await respondToUtterance({targetId:original.id,text:'  Answer\nunfinished  ',type:'contradicts',provenance},{archive});
 const second=await respondToUtterance({targetId:first.utterance.id,text:'I return.',type:'returns-to',provenance},{archive});
 assert.deepEqual(await archive.getUtterance(original.id),original);
 assert.equal(first.utterance.text,'  Answer\nunfinished  ');
 assert.equal(first.relation.fromId,first.utterance.id);assert.equal(first.relation.toId,original.id);
 assert.equal(first.relation.provenance.origin,'author');
 assert.equal(second.relation.toId,first.utterance.id);
 const inspection=await getUtteranceInspection(first.utterance.id,{archive});
 assert.deepEqual(new Set(inspection.relatedUtterances.map(x=>x.id)),new Set([original.id,second.utterance.id]));
 const copy=repository();await importAll(copy,await exportAll(archive));
 assert.deepEqual(await copy.getUtterance(first.utterance.id),first.utterance);
 assert.deepEqual(new Set((await copy.listRelations()).map(x=>x.id)),new Set([first.relation.id,second.relation.id]));
});
test('failed relation insert rolls back the new words too',async()=>{
 const archive=repository(),original=await archive.createUtterance({id:'original',text:'Old'});
 await archive.createRelation({id:'occupied',fromId:original.id,toId:original.id,type:'responds-to',provenance});
 await assert.rejects(()=>archive.createResponse({id:'must-not-survive',text:'New'},{id:'occupied',toId:original.id,type:'responds-to',provenance}));
 assert.equal(await archive.getUtterance('must-not-survive'),undefined);
 assert.equal((await archive.listUtterances()).length,1);
});
test('response boundary refuses missing targets, tombstones, missing provenance, AI and empty words',async()=>{
 const archive=repository();await archive.createUtterance({id:'removed',text:'Before'});await archive.tombstoneUtterance('removed');
 for(const target of ['missing','removed'])await assert.rejects(()=>archive.createResponse({text:'After'},{toId:target,type:'responds-to',provenance}),/unavailable/);
 for(const origin of [undefined,'ai','import'])await assert.rejects(()=>archive.createResponse({text:'After'},{toId:'removed',type:'responds-to',provenance:origin?{origin}:undefined}),/author provenance/);
 await assert.rejects(()=>respondToUtterance({targetId:'removed',text:'   ',provenance},{archive}),/response first/);
 assert.equal((await archive.listUtterances({includeHistory:true})).length,1);
 assert.equal((await archive.listRelations()).length,0);
});

 test('connected words escape text and keep withdrawn or unavailable relations visible',async()=>{
 const {connectedWords}=await import('../js/views/responses.js');
 const relation={fromId:'reply',toId:'past',type:'corrects',status:'withdrawn',directional:true,provenance:{origin:'author'}};
 const markup=connectedWords({id:'reply'},[relation],[{id:'past',text:'<script>exact words</script>',metadata:{status:'kept'}}]);
 assert.match(markup,/withdrawn/);assert.match(markup,/These words → connected words/);
 assert.match(markup,/&lt;script&gt;exact words&lt;\/script&gt;/);assert.doesNotMatch(markup,/<script>/);
 const unavailable=connectedWords({id:'reply'},[relation],[{id:'past',text:'Removed words',metadata:{status:'tombstoned'}}]);
 assert.match(unavailable,/unavailable/);assert.doesNotMatch(unavailable,/Removed words|data-open-related/);
 });
