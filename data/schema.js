export const SCHEMA_VERSION = 5;
export const DATE_PRECISIONS = ['exact','day','month','year','unknown','approximate'];
export const RELATION_TYPES = ['corrects','returns-to','develops','contradicts','responds-to','continues','similar-to'];
export const FORM_TYPES = ['fragment','lyric','fiction','question','essay','note','correction','unknown'];
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const string=(value,field,{
  nullable=false,empty=false
}
={
})=>{
  if(value===null&&nullable)return;
  if(typeof value!=='string'||(!empty&&!value.trim()))throw new Error(`${field} must be a ${nullable?'nullable ':''}string`);
};
const provenance=(value,field)=>{
  if(!object(value))throw new Error(`${field}.provenance must be an object`);
  string(value.origin,`${field}.provenance.origin`);
  if(value.origin==='ai')string(value.model,`${field}.provenance.model`);
};
export function validateTemporalWindow(value={
}){
  if(!object(value))throw new Error('utterance.temporal must be an object');
  if(value.earliest!==null&&value.earliest!==undefined)string(value.earliest,'temporal.earliest');
  if(value.latest!==null&&value.latest!==undefined)string(value.latest,'temporal.latest');
  if(value.precision&&!DATE_PRECISIONS.includes(value.precision))throw new Error('temporal.precision is invalid');
  if(value.display!==null&&value.display!==undefined)string(value.display,'temporal.display',{
    empty:true
  });
  if(value.earliest&&value.latest&&value.earliest>value.latest)throw new Error('temporal.earliest cannot be after temporal.latest');
  return true;
}
export function validateUtterance(value){
  if(!object(value))throw new Error('Utterance must be an object');
  string(value.id,'utterance.id');
  const awaiting=value.metadata?.status==='awaiting-transcription';
  string(value.text,'utterance.text',{
    nullable:awaiting,empty:awaiting
  });
  string(value.createdAt,'utterance.createdAt');
  for(const field of ['deletedAt','deletionReason']){
    if(value[field]!==undefined)string(value[field],`utterance.${field}`,{nullable:true,empty:true});
  }
  validateTemporalWindow(value.temporal||{
  });
  if(value.source!==undefined&&!object(value.source))throw new Error('utterance.source must be an object');
  if(value.metadata!==undefined&&!object(value.metadata))throw new Error('utterance.metadata must be an object');
  return true;
}
export function validateArtifact(value){
  if(!object(value))throw new Error('Artifact must be an object');
  string(value.id,'artifact.id');
  string(value.kind,'artifact.kind');
  string(value.storageRef,'artifact.storageRef');
  string(value.mimeType,'artifact.mimeType');
  return true;
}
export function validateTranscription(value){
  if(!object(value))throw new Error('Transcription must be an object');
  string(value.id,'transcription.id');
  string(value.artifactId,'transcription.artifactId');
  string(value.text,'transcription.text',{
    empty:true
  });
  string(value.createdAt,'transcription.createdAt');
  provenance(value.provenance,'transcription');
  if(!object(value.attestation))throw new Error('transcription.attestation must be an object');
  if(!['unreviewed','confirmed-by-author','rejected','withdrawn'].includes(value.attestation.state))throw new Error('transcription.attestation.state is invalid');
  return true;
}
export function validateAnnotation(value){
  if(!object(value))throw new Error('Annotation must be an object');
  string(value.id,'annotation.id');
  string(value.targetId,'annotation.targetId');
  string(value.targetType,'annotation.targetType');
  string(value.text,'annotation.text');
  string(value.createdAt,'annotation.createdAt');
  provenance(value.provenance,'annotation');
  return true;
}
export function validateInterpretation(value){
  if(!object(value))throw new Error('Interpretation must be an object');
  string(value.id,'interpretation.id');
  string(value.targetId,'interpretation.targetId');
  string(value.reading,'interpretation.reading');
  string(value.createdAt,'interpretation.createdAt');
  provenance(value.provenance,'interpretation');
  return true;
}
export function validateRelation(value){
  if(!object(value))throw new Error('Relation must be an object');
  string(value.id,'relation.id');
  string(value.type,'relation.type');
  if(!RELATION_TYPES.includes(value.type))throw new Error('relation.type is invalid');
  string(value.fromId,'relation.fromId');
  string(value.toId,'relation.toId');
  if(typeof value.directional!=='boolean')throw new Error('relation.directional must be boolean');
  provenance(value.provenance,'relation');
  for(const field of ['deletedAt','withdrawalReason']){
    if(value[field]!==undefined)string(value[field],`relation.${field}`,{nullable:true,empty:true});
  }
  return true;
}
export function validateConstellation(value){
  if(!object(value))throw new Error('Constellation must be an object');
  string(value.id,'constellation.id');
  string(value.name,'constellation.name');
  string(value.createdAt,'constellation.createdAt');
  if(!Array.isArray(value.aliases)||value.aliases.some(alias=>typeof alias!=='string'||!alias.trim()))throw new Error('constellation.aliases must be an array of non-empty strings');
  if(value.description!==null&&value.description!==undefined)string(value.description,'constellation.description',{
    empty:true
  });
  if(!['active','retired'].includes(value.status))throw new Error('constellation.status is invalid');
  provenance(value.provenance,'constellation');
  return true;
}
export function validateMembership(value){
  if(!object(value))throw new Error('Membership must be an object');
  string(value.id,'membership.id');
  string(value.constellationId,'membership.constellationId');
  string(value.utteranceId,'membership.utteranceId');
  string(value.createdAt,'membership.createdAt');
  if(!['active','withdrawn'].includes(value.status))throw new Error('membership.status is invalid');
  provenance(value.provenance,'membership');
  if(value.note!==null&&value.note!==undefined)string(value.note,'membership.note',{
    empty:true
  });
  if(value.withdrawalReason!==null&&value.withdrawalReason!==undefined)string(value.withdrawalReason,'membership.withdrawalReason',{
    empty:true
  });
  if(value.status==='active'&&value.withdrawnAt!==null&&value.withdrawnAt!==undefined)throw new Error('active membership cannot have withdrawnAt');
  if(value.status==='withdrawn')string(value.withdrawnAt,'membership.withdrawnAt');
  return true;
}
export function validateSuggestion(value){
  if(!object(value))throw new Error('Suggestion must be an object');
  string(value.id,'suggestion.id');
  string(value.kind,'suggestion.kind');
  if(!object(value.payload))throw new Error('suggestion.payload must be an object');
  provenance(value.provenance,'suggestion');
  if(!['pending','accepted','rejected'].includes(value.status))throw new Error('suggestion.status is invalid');
  if(value.status==='pending'){
    if(value.decision!==null&&value.decision!==undefined)throw new Error('pending suggestion cannot have a decision');
    return true;
  }
  if(!object(value.decision))throw new Error('decided suggestion must have a decision');
  if(value.decision.status!==value.status)throw new Error('suggestion.decision.status must match suggestion.status');
  string(value.decision.decidedAt,'suggestion.decision.decidedAt');
  provenance(value.decision.provenance,'suggestion.decision');
  if(value.decision.provenance.origin!=='author')throw new Error('suggestion decision must be author provenance');
  if(value.decision.reason!==null&&value.decision.reason!==undefined)string(value.decision.reason,'suggestion.decision.reason');
  if(value.status==='accepted')string(value.decision.canonicalEntityId,'suggestion.decision.canonicalEntityId');
  if(value.status==='rejected'&&value.decision.canonicalEntityId!==null&&value.decision.canonicalEntityId!==undefined)throw new Error('rejected suggestion cannot name a canonical entity');
  return true;
}
