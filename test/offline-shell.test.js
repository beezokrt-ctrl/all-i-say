import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const source=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const root=new URL('../',import.meta.url);
const assets=[...source.matchAll(/'\.\/([^']+)'/g)].map(x=>x[1]).filter(x=>x!=='');

test('offline allowlist covers static and dynamic local module dependencies',()=>{
  const visited=new Set();
  function walk(file){
    if(visited.has(file))return;visited.add(file);
    assert.ok(assets.includes(file),file+' missing from offline shell');
    const code=readFileSync(new URL(file,root),'utf8');
    for(const match of code.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"](\.[^'"]+)['"]/g)){
      walk(path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1])));
    }
  }
  walk('js/app.js');
  for(const file of assets)assert.ok(existsSync(new URL(file,root)),file+' not found');
});

test('shell only caches its allowlist, retains old caches until activation and never forces reload',async()=>{
  const handlers={},deleted=[],fetched=[],cacheNames=['unrelated','all-i-say-shell:'+encodeURIComponent('https://test.example/app/')+':old'];
  let install;
  const context={
    URL,Request,Set,
    self:{registration:{scope:'https://test.example/app/'},clients:{async claim(){}},addEventListener:(name,handler)=>handlers[name]=handler},
    caches:{async open(){return {async addAll(requests){install=requests;},async match(url){return 'cached:'+url;}};},async keys(){return cacheNames;},async delete(name){deleted.push(name);}},
    fetch:async request=>{fetched.push(request);return 'network';}
  };
  vm.runInNewContext(source,context);
  let promise;handlers.install({waitUntil(value){promise=value;}});await promise;
  assert.equal(deleted.length,0);assert.ok(install.length>20);
  for(const url of ['https://test.example/private.json','https://other.example/app/js/app.js','https://test.example/app/artifact.png']){
    let handled=false;handlers.fetch({request:new Request(url),respondWith(){handled=true;}});assert.equal(handled,false);
  }
  handlers.fetch({request:new Request('https://test.example/app/'),respondWith(value){promise=value;}});
  assert.equal(await promise,'cached:https://test.example/app/index.html');
  handlers.activate({waitUntil(value){promise=value;}});await promise;
  assert.deepEqual(deleted,[cacheNames[1]]);assert.deepEqual(fetched,[]);
  // No skipWaiting API is supplied; an attempted forced update would fail.
});

test('failed shell installation removes the incomplete cache',async()=>{
  const handlers={},deleted=[];
  vm.runInNewContext(source,{URL,Request,Set,self:{registration:{scope:'https://test.example/'},addEventListener:(key,handler)=>handlers[key]=handler},caches:{async open(){return {async addAll(){throw Error('offline');}};},async delete(name){deleted.push(name);}}});
  let promise;handlers.install({waitUntil(value){promise=value;}});
  await assert.rejects(()=>promise,/offline/);assert.equal(deleted.length,1);
});
