import { getArchive } from './archive.js';
const normalize=value=>String(value??'').toLocaleLowerCase();
export async function searchArchive(query,{form,thread,status='kept'}={}){
 const q=normalize(query).trim(); if(!q)return [];
 const archive=await getArchive(),items=await archive.listUtterances({form,thread,status,limit:Infinity});
 return items.map(item=>{const text=normalize(item.text),threads=(item.metadata?.threads||[]).map(normalize),formText=normalize(item.metadata?.form);let score=0;if(text===q)score+=100;if(text.includes(q))score+=40;if(text.startsWith(q))score+=20;if(threads.some(t=>t.includes(q)))score+=15;if(formText.includes(q))score+=5;return {item,score};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||b.item.createdAt.localeCompare(a.item.createdAt)).map(x=>x.item);
}
