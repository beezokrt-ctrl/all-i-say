import { createUtterance } from '../../domain/utterance.js';
import { FORM_TYPES } from '../../../data/schema.js';
const LEGACY_KIND_MAP={statement:'fragment',question:'question',fragment:'fragment',lyric:'lyric',fiction:'fiction',essay:'essay',note:'note',correction:'correction'};
const mapKind=k=>FORM_TYPES.includes(k)?k:(LEGACY_KIND_MAP[k]||'unknown');
export function parseLegacyDate(value){
 const display=value==null?null:String(value).trim(); if(!display)return {earliest:null,latest:null,precision:'unknown',display:null};
 const y=display.match(/\b(\d{4})\b/); if(!y)return {earliest:null,latest:null,precision:'unknown',display};
 const year=Number(y[1]),m=display.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:uary|ruary|ch|il|e|y|ust|tember|ober|ember)?\b/i);
 if(!m)return {earliest:`${year}-01-01`,latest:`${year}-12-31`,precision:'year',display};
 const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12},month=months[m[1].slice(0,3).toLowerCase()],mm=String(month).padStart(2,'0');
 const day=display.match(/\b([12]?\d|3[01])(?:st|nd|rd|th)?\b/);
 if(day){const dd=String(Number(day[1])).padStart(2,'0'),d=`${year}-${mm}-${dd}`;return {earliest:d,latest:d,precision:'day',display};}
 const last=String(new Date(year,month,0).getDate()).padStart(2,'0');return {earliest:`${year}-${mm}-01`,latest:`${year}-${mm}-${last}`,precision:'month',display};
}
export async function migrateV2toV3(entries=[]){
 const out=[],errors=[];for(const old of entries){try{if(!old.id)throw new Error('V2 entry missing id');if(!old.text)throw new Error('V2 entry missing text');out.push(createUtterance({id:old.id,text:old.text,createdAt:old.createdAt||new Date().toISOString(),temporal:parseLegacyDate(old.date),source:{type:'imported',conversationId:null,context:null,artifactIds:[]},metadata:{form:mapKind(old.kind),threads:Array.isArray(old.threads)?old.threads:[],status:'kept'}}));}catch(error){errors.push({v2Entry:old,reason:error.message});}}
 if(errors.length){const e=new Error(`Migration failed: ${errors.length} of ${entries.length} entries could not be transformed`);e.failedEntries=errors;throw e;}return out;
}
