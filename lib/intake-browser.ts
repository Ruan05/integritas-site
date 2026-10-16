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
export function validateSubmissionFiles(files:File[]){
  if(files.length<1||files.length>20)throw new Error('Select between 1 and 20 evidence files.');
  for(const file of files){
    if(!intakeMime(file)||!file.name||Array.from(file.name).length>255)throw new Error('Select a supported evidence file with a name of at most 255 characters.');
    if(file.size<1||file.size>50*1024*1024)throw new Error('Each evidence file must be between 1 byte and 50 MiB.');
  }
}
type Request=(token:string,body:Record<string,unknown>)=>Promise<any>;
export function createIntakeBrowserClient(request:Request,fetchImpl:typeof fetch,adminApiUrl:string):IntakeClient{
  return {
    async beginSubmission(token,input){
      validateSubmissionFiles(input.files);
      if(Array.from(input.question).length>3000||Array.from(input.context).length>6000)throw new Error('Submission brief exceeds its character limit.');
      return request(token,{action:'begin_submission',caseId:input.caseId,caseRevision:input.caseRevision,clientKey:input.clientKey,question:input.question,context:input.context,replaceConfirmed:input.replaceConfirmed,items:input.files.map((file,i)=>({key:`file-${i}`,name:file.name,mime_type:intakeMime(file),size_bytes:file.size}))});
    },
    submissionStatus(token,batchId,caseId){return request(token,{action:'submission_status',caseId,batchId});},
    cancelSubmission(token,batchId,caseId){return request(token,{action:'cancel_submission',batchId,caseId});},
    async uploadSubmissionItem(token,batchId,itemId,file){
      const reserved=await request(token,{action:'reserve_submission_item',batchId,itemId});
      const finalize=()=>request(token,{action:'finalize_submission_item',batchId,itemId});
      // Resolve an uploaded/verified object before creating transport work again.
      try{return await finalize();}catch(e){if((e as {code?:string})?.code!=='OBJECT_NOT_AVAILABLE')throw e;}
      validateSubmissionFiles([file]);
      if(reserved.verified||reserved.name!==file.name||reserved.size!==file.size||reserved.mime!==intakeMime(file))throw new Error('Reselected evidence does not match the required item.');
      const upload=new URL(reserved.uploadUrl),api=new URL(adminApiUrl);
      if(upload.protocol!=='https:'||upload.origin!==api.origin||upload.username||upload.password||!upload.pathname.startsWith('/storage/v1/object/upload/sign/'))throw new Error('Invalid evidence upload capability.');
      const result=await fetchImpl(upload.toString(),{method:'PUT',headers:{'content-type':reserved.mime,'x-upsert':'false'},body:file});
      // A conflict can be a previous successful upload whose response was lost.
      if(!result.ok&&result.status!==409)throw new Error('Evidence upload interrupted. Resume this submission; do not create another batch.');
      return finalize();
    }
  };
}

