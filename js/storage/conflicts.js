const plainEqual=(a,b)=>{
 if(Object.is(a,b))return true;
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return false;
 if(Array.isArray(a)||Array.isArray(b)){
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length)return false;
  return a.every((value,index)=>plainEqual(value,b[index]));
 }
 const ak=Object.keys(a).sort(),bk=Object.keys(b).sort();
 return ak.length===bk.length&&ak.every((key,index)=>key===bk[index]&&plainEqual(a[key],b[key]));
};

export function recordsEqual(a,b){return plainEqual(a,b);}

export async function blobsEqual(a,b){
 if(a===b)return true;
 if(!(a instanceof Blob)||!(b instanceof Blob)||a.type!==b.type||a.size!==b.size)return false;
 const [aa,bb]=await Promise.all([a.arrayBuffer(),b.arrayBuffer()]);
 const av=new Uint8Array(aa),bv=new Uint8Array(bb);
 return av.every((byte,index)=>byte===bv[index]);
}

export async function artifactsEqual(existing,incoming){
 if(!existing||!incoming)return false;
 const {blob:existingBlob,...existingMeta}=existing;
 return recordsEqual(existingMeta,incoming.meta)&&await blobsEqual(existingBlob,incoming.blob);
}
