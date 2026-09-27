const blobToDataURL = blob => new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});
export async function exportAll(repository){
 const artifacts=await repository.listArtifacts();
 const portableArtifacts=[];
 for(const item of artifacts){const {blob,...meta}=item;portableArtifacts.push({...meta,data:blob instanceof Blob?await blobToDataURL(blob):null});}
 return {exportFormatVersion:3,schemaVersion:await repository.getSchemaVersion(),exportedAt:new Date().toISOString(),utterances:await repository.listUtterances({status:undefined,limit:Infinity}),artifacts:portableArtifacts,transcriptions:await repository.listTranscriptions({}),relations:await repository.listRelations({status:undefined}),constellations:await repository.listConstellations({status:undefined}),memberships:await repository.listMemberships({status:undefined})};
}
export function downloadExport(payload,filename=`all-i-say-export-${new Date().toISOString().slice(0,10)}.json`){const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;link.click();URL.revokeObjectURL(url);}
