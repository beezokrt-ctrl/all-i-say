const blobToDataURL = blob => new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(reader.result);
  reader.onerror=()=>reject(reader.error||new Error('Could not read an artifact for backup'));
  reader.readAsDataURL(blob);
});

export async function exportAll(repository){
  const snapshot=await repository.getExportSnapshot();
  const artifacts=[];
  for(const item of snapshot.artifacts){
    const {blob,...meta}=item;
    artifacts.push({...meta,data:blob instanceof Blob?await blobToDataURL(blob):null});
  }
  return {exportFormatVersion:3,...snapshot,artifacts};
}

export function downloadExport(payload,filename=`all-i-say-export-${new Date().toISOString().slice(0,10)}.json`){
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;
  link.download=filename;
  link.hidden=true;
  document.body.append(link);
  try{link.click();}
  catch(error){URL.revokeObjectURL(url);throw error;}
  finally{link.remove();}
  // Keep the URL available for an explicit retry in Safari. The controller
  // releases the previous export when another file is prepared.
  return {url,filename,release:()=>URL.revokeObjectURL(url)};
}
