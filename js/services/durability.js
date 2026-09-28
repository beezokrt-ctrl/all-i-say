// Browser storage policy is separate from canonical archive content.
export async function getStorageProtection(storage=globalThis.navigator?.storage){
  if(typeof storage?.persisted!=='function')return 'unsupported';
  try{return await storage.persisted()?'granted':'best-effort';}
  catch{return 'unavailable';}
}

export async function requestStorageProtection(storage=globalThis.navigator?.storage){
  if(typeof storage?.persist!=='function')return 'unsupported';
  try{return await storage.persist()?'granted':'denied';}
  catch{return 'unavailable';}
}
