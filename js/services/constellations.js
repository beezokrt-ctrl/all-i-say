import { getArchive } from './archive.js';

export async function getConstellationPlaces(){
 const archive=await getArchive();
 const [constellations,memberships,utterances]=await Promise.all([
  archive.listConstellations({status:'active'}),
  archive.listMemberships({status:'active'}),
  archive.listUtterances({status:'kept',limit:Infinity})
 ]);
 const byId=new Map(utterances.map(u=>[u.id,u]));
 return constellations.map(constellation=>{
  const memberIds=memberships.filter(m=>m.constellationId===constellation.id).map(m=>m.utteranceId);
  const gathered=memberIds.map(id=>byId.get(id)).filter(Boolean);
  return {constellation,count:gathered.length,utterances:gathered};
 }).sort((a,b)=>b.count-a.count||a.constellation.name.localeCompare(b.constellation.name));
}

export async function getLegacyThreadGatherings(){
 const archive=await getArchive();
 const utterances=await archive.listUtterances({status:'kept',limit:Infinity});
 const groups=new Map();
 for(const utterance of utterances)for(const name of utterance.metadata?.threads||[]){
  if(!name||name==='Unplaced')continue;
  if(!groups.has(name))groups.set(name,[]);
  groups.get(name).push(utterance);
 }
 return [...groups].map(([name,items])=>({name,count:items.length,utterances:items})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
}
