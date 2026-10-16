export type SubmissionItem = {id:string;key:string;name:string;mime:string;size:number;state:'pending'|'verified';documentId?:string|null};
export type SubmissionStatus = {
  batchId:string;caseId:string;caseRevision:number;state:'open'|'sealed'|'cancelled'|'expired';
  items:SubmissionItem[];intentState:string|null;reason:string|null;jobId?:string|null;
};
export type SubmissionInput = {caseId:string;caseRevision:number;clientKey:string;question:string;context:string;files:File[];replaceConfirmed:boolean};
export type IntakeClient = {
  beginSubmission(token:string,input:SubmissionInput):Promise<SubmissionStatus>;
  uploadSubmissionItem(token:string,batchId:string,itemId:string,file:File):Promise<SubmissionStatus>;
  submissionStatus(token:string,batchId:string|null,caseId:string):Promise<SubmissionStatus|null>;
  cancelSubmission(token:string,batchId:string,caseId:string):Promise<SubmissionStatus>;
};
const types:Record<string,string>={pdf:'application/pdf',txt:'text/plain',md:'text/markdown',csv:'text/csv',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg'};
export const INTAKE_ACCEPT='.pdf,.txt,.md,.csv,.png,.jpg,.jpeg';
export function intakeMime(file:File){return types[file.name.split('.').pop()?.toLowerCase()??'']??'';}
export function buildFullDDSubmissionFiles(files:File[],brief:string){
  if(files.length)return files;
  const text=String(brief??'').trim();
  if(!text)throw new Error('Enter a DD brief or attach evidence before starting a full investigation.');
  if(Array.from(text).length>3000)throw new Error('Your DD brief is limited to 3,000 characters.');
  return [new File([text],'dd-brief.txt',{type:'text/plain'})];
}
export function hasVerifiedCaseEvidence(documents:Array<{sha256?:unknown}>){
  return Array.isArray(documents)&&documents.some((document)=>/^[a-f0-9]{64}$/i.test(String(document?.sha256??'')));
}
export function buildQuestionOnlyRevisionRequest(input:{caseId:string;caseRevision:number;clientKey:string;question:string;context:string;replaceConfirmed:boolean}){
  const caseId=String(input.caseId??'').trim();
  if(!caseId||caseId.length>128)throw new Error('A valid case is required for a question-only revision.');
  if(!Number.isSafeInteger(input.caseRevision)||input.caseRevision<0)throw new Error('A valid case revision is required.');
  const clientKey=String(input.clientKey??'').trim();
  if(!/^[A-Za-z0-9._:-]{8,160}$/.test(clientKey))throw new Error('A valid idempotency key is required.');
  const question=String(input.question??'').trim();
  const context=String(input.context??'');
  if(Array.from(question).length>3000)throw new Error('Your DD brief is limited to 3,000 characters.');
  if(Array.from(context).length>6000)throw new Error('Your conversation context is limited to 6,000 characters.');
  if(typeof input.replaceConfirmed!=='boolean')throw new Error('Active-run replacement confirmation is required.');
  return {action:'start_question_only_revision',caseId,caseRevision:input.caseRevision,clientKey,question,context,replaceConfirmed:input.replaceConfirmed};
}
export function validateSubmissionFiles(files:File[]){
  if(files.length<1||files.length>20)throw new Error('Select between 1 and 20 evidence files.');
  for(const file of files){
    if(!intakeMime(file)||!file.name||Array.from(file.name).length>255)throw new Error('Select a supported evidence file with a name of at most 255 characters.');
    if(file.size<1||file.size>50*1024*1024)throw new Error('Each evidence file must be between 1 byte and 50 MiB.');
  }
}
type Request=(token:string,body:Record<string,unknown>)=>Promise<unknown>;
export function createIntakeBrowserClient(request:Request,fetchImpl:typeof fetch,adminApiUrl:string):IntakeClient{
  return {
    async beginSubmission(token,input){
      validateSubmissionFiles(input.files);
      if(Array.from(input.question).length>3000||Array.from(input.context).length>6000)throw new Error('Submission brief exceeds its character limit.');
      return await request(token,{action:'begin_submission',caseId:input.caseId,caseRevision:input.caseRevision,clientKey:input.clientKey,question:input.question,context:input.context,replaceConfirmed:input.replaceConfirmed,items:input.files.map((file,i)=>({key:`file-${i}`,name:file.name,mime_type:intakeMime(file),size_bytes:file.size}))}) as SubmissionStatus;
    },
    async submissionStatus(token,batchId,caseId){return await request(token,{action:'submission_status',caseId,batchId}) as SubmissionStatus|null;},
    async cancelSubmission(token,batchId,caseId){return await request(token,{action:'cancel_submission',batchId,caseId}) as SubmissionStatus;},
    async uploadSubmissionItem(token,batchId,itemId,file){
      const reservation=await request(token,{action:'reserve_submission_item',batchId,itemId});
      if(!reservation||typeof reservation!=='object'||Array.isArray(reservation))throw new Error('Evidence upload reservation is invalid.');
      const reserved=reservation as Record<string,unknown>;
      const finalize=async()=>await request(token,{action:'finalize_submission_item',batchId,itemId}) as SubmissionStatus;
      // Resolve an uploaded/verified object before creating transport work again.
      try{return await finalize();}catch(e){if((e as {code?:string})?.code!=='OBJECT_NOT_AVAILABLE')throw e;}
      validateSubmissionFiles([file]);
      if(reserved.verified||reserved.name!==file.name||reserved.size!==file.size||reserved.mime!==intakeMime(file))throw new Error('Reselected evidence does not match the required item.');
      if(typeof reserved.uploadUrl!=='string'||typeof reserved.mime!=='string')throw new Error('Invalid evidence upload capability.');
      const upload=new URL(reserved.uploadUrl),api=new URL(adminApiUrl);
      if(upload.protocol!=='https:'||upload.origin!==api.origin||upload.username||upload.password||!upload.pathname.startsWith('/storage/v1/object/upload/sign/'))throw new Error('Invalid evidence upload capability.');
      const result=await fetchImpl(upload.toString(),{method:'PUT',headers:{'content-type':reserved.mime,'x-upsert':'false'},body:file});
      // A conflict can be a previous successful upload whose response was lost.
      if(!result.ok&&result.status!==409)throw new Error('Evidence upload interrupted. Resume this submission; do not create another batch.');
      return finalize();
    }
  };
}

