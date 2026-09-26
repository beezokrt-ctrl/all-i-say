const stable=value=>{
 if(value instanceof Blob)return {type:value.type,size:value.size};
 if(Array.isArray(value))return value.map(stable);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
 return value;
};

const sameBlob=async(a,b)=>{
 if(!(a instanceof Blob)||!(b instanceof Blob)||a.type!==b.type||a.size!==b.size)return false;
 const [aa,bb]=await Promise.all([a.arrayBuffer(),b.arrayBuffer()]);
 const av=new Uint8Array(aa),bv=new Uint8Array(bb);
 for(let i=0;i<av.length;i++)if(av[i]!==bv[i])return false;
 return true;
};

export async function recordsEquivalent(a,b){
 if(a?.blob||b?.blob){
  const {blob:ab,...am}=a||{}, {blob:bb,...bm}=b||{};
  return JSON.stringify(stable(am))===JSON.stringify(stable(bm))&&await sameBlob(ab,bb);
 }
 return JSON.stringify(stable(a))===JSON.stringify(stable(b));
}
