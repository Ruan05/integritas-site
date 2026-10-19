import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true}});
after(()=>vite.close());
const {createIntakeBrowserClient}=await vite.ssrLoadModule('/lib/intake-browser.ts');
const {nativeReportReady,reportAudience}=await vite.ssrLoadModule('/lib/native-report-download.ts');

const {oraclePairReady}=await vite.ssrLoadModule('/lib/oracle-report-pair.ts');

test('lost upload acknowledgements reconcile without reuploading evidence',async()=>{
  const calls=[];let uploads=0;
  const client=createIntakeBrowserClient(async(_token,body)=>{calls.push(body.action);return {state:'sealed'};},async()=>{uploads++;},'https://project.supabase.co/functions/v1/admin');
  const status=await client.uploadSubmissionItem('session','batch','item',new File(['evidence'],'proof.txt'));
  assert.equal(status.state,'sealed');assert.equal(uploads,0);
  assert.deepEqual(calls,['reserve_submission_item','finalize_submission_item']);
});
test('uploads only to the signed private Storage origin and preserves the frozen brief',async()=>{
  let uploadCalls=0,begin;
  const file=new File(['evidence'],'proof.txt',{type:'text/plain'});
  const client=createIntakeBrowserClient(async(_token,body)=>{
    if(body.action==='begin_submission'){begin=body;return {};}
    if(body.action==='reserve_submission_item')return {name:file.name,size:file.size,mime:'text/plain',uploadUrl:'https://other.example/storage/v1/object/upload/sign/x'};
    throw Object.assign(new Error('missing'),{code:'OBJECT_NOT_AVAILABLE'});
  },async()=>{uploadCalls++;},'https://project.supabase.co/functions/v1/admin');
  await client.beginSubmission('session',{caseId:'case',caseRevision:3,clientKey:'same-key',question:'Exact question',context:'Exact context',files:[file],replaceConfirmed:false});
  assert.equal(begin.question,'Exact question');assert.equal(begin.context,'Exact context');assert.equal(begin.caseRevision,3);
  await assert.rejects(client.uploadSubmissionItem('session','batch','item',file),/Invalid evidence upload capability/);
  assert.equal(uploadCalls,0);
});
test('final native downloads reject stale, unfinished and mismatched report editions',()=>{
  const job={id:'job',runtime_provider:'ruan-native',stage:'completed',case_revision:4};
  const report={case_job_id:'job',status:'finalized',based_on_revision:4};
  assert.equal(nativeReportReady(job,report,4,false),true);
  assert.equal(nativeReportReady(job,report,5,false),false);
  assert.equal(nativeReportReady({...job,stage:'drafting_report'},report,4,false),false);
  assert.equal(nativeReportReady(job,{...report,case_job_id:'another'},4,false),false);
  assert.equal(nativeReportReady(job,report,4,true),false);
  assert.equal(reportAudience('internal'),'internal');assert.equal(reportAudience(null),'external');
  assert.throws(()=>reportAudience('all'),/Unsupported/);
});

test('Oracle final controls require both current editions from the same atomic receipt',()=>{
  const job={id:'job',case_id:'case',case_revision:2,stage:'completed',runtime_provider:'openclaw-oracle'};
  const report={id:'report',case_id:'case',case_job_id:'job',based_on_revision:2,status:'finalized',finalization_method:'automated_independent_review',report_model_sha256:'model'};
  const pair={report_id:'report',case_id:'case',case_job_id:'job',case_revision:2,report_model_sha256:'model',external_sha256:'e'.repeat(64),internal_sha256:'f'.repeat(64)};
  assert.equal(oraclePairReady(job,report,[pair],2),true);
  assert.equal(oraclePairReady(job,report,[],2),false);
  assert.equal(oraclePairReady(job,report,[pair],3),false);
  assert.equal(oraclePairReady(job,report,[{...pair,case_id:'another'}],2),false);
  assert.equal(oraclePairReady(job,report,[{...pair,internal_sha256:pair.external_sha256}],2),false);
  assert.equal(oraclePairReady(job,{...report,report_model_sha256:'different'},[pair],2),false);
});
