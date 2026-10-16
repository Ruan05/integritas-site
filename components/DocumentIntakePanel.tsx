"use client";
import {useEffect,useRef,useState} from 'react';
import {caseChatRequest} from '@/components/CaseAgentChat';
import {INTAKE_ACCEPT,intakeMime,validateSubmissionFiles} from '@/lib/intake-browser';
import type {IntakeClient,SubmissionInput,SubmissionStatus} from '@/lib/intake-browser';

type Props={token:string;caseId:string;caseRevision:number;existingCount:number;client:IntakeClient;onChanged:(jobId?:string)=>void|Promise<void>};
// A case or identity change unmounts all sensitive in-memory brief/file/status state.
export function DocumentIntakePanel(props:Props){return <IntakeForm key={props.caseId+':'+props.token} {...props}/>;}
function IntakeForm({token,caseId,caseRevision,client,onChanged}:Props){
  const [files,setFiles]=useState<File[]>([]),[question,setQuestion]=useState('');
  const [status,setStatus]=useState<SubmissionStatus|null>(null),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false);
  const [error,setError]=useState(''),[replaceConfirmed,setReplaceConfirmed]=useState(false);
  const [itemFiles,setItemFiles]=useState<Record<string,File>>({});
  const active=useRef(true),inFlight=useRef(false),attempt=useRef<SubmissionInput|null>(null),latest=useRef<SubmissionStatus|null>(null);
  const sequence=useRef(0);
  const drafting=useRef(false);
  const change=useRef(onChanged);change.current=onChanged;
  const notified=useRef<{batchId:string|null;jobId:string|null}>({batchId:null,jobId:null});
  async function notify(next:SubmissionStatus|null){
    if(!active.current||next?.state!=='sealed')return;
    const jobId=next.jobId??null;
    if(notified.current.batchId===next.batchId&&notified.current.jobId===jobId)return;
    const previous=notified.current,notice={batchId:next.batchId,jobId};notified.current=notice;
    try{await change.current(jobId??undefined);}catch{if(active.current){if(notified.current===notice)notified.current=previous;setError('Submission saved, but the case view could not refresh. Reopen the case to retry.');}}
  }
  const report=(next:SubmissionStatus|null)=>{latest.current=next;if(active.current)setStatus(next);};
  useEffect(()=>{
    active.current=true;let checking=false;let valid=true;
    const check=async()=>{
      if(checking||inFlight.current||drafting.current)return;checking=true;
      const epoch=sequence.current;
      try{const next=await client.submissionStatus(token,latest.current?.batchId??null,caseId);if(valid&&active.current&&sequence.current===epoch){latest.current=next;if(next?.state==='expired'||next?.state==='cancelled')attempt.current=null;setStatus(next);setLoaded(true);setError('');await notify(next);}}
      catch{if(valid&&active.current&&sequence.current===epoch){setLoaded(false);setError('Could not recover submission status. Refresh before starting a new submission.');}}
      finally{checking=false;}
    };
    void check();const timer=setInterval(()=>void check(),15000);
    return()=>{valid=false;active.current=false;clearInterval(timer);};
  },[token,caseId,client]);
  const open=status?.state==='open';
  const missing=open?status.items.filter(i=>i.state==='pending'):[];
  const frozen=Boolean(attempt.current)||Boolean(status&&status.state!=='cancelled'&&status.state!=='expired');
  async function submit(){
    if(inFlight.current||!loaded)return;
    inFlight.current=true;sequence.current++;setBusy(true);setError('');
    let beginning=false;
    try{
      if(Array.from(question).length>3000)throw new Error('Your message must be no more than 3,000 characters.');
      let current=latest.current;
      if(!current||current.state==='cancelled'||current.state==='expired'){
        if(!attempt.current){
          validateSubmissionFiles(files);
          const recalled=await caseChatRequest({action:'chat_context',caseId});
          if(!active.current)return;
          // Freeze recalled history with the accepted brief, including during network retries.
          attempt.current={caseId,caseRevision,clientKey:'intake:'+crypto.randomUUID(),question,context:recalled.context||'',files,replaceConfirmed};
        }
        beginning=true;current=await client.beginSubmission(token,attempt.current);beginning=false;if(!active.current)return;drafting.current=false;report(current);
      }
      if(current.state!=='open'){if(current.state==='expired'||current.state==='cancelled')attempt.current=null;await notify(current);return;}
      const available=[...files];
      for(const item of current.items.filter(i=>i.state==='pending')){
        const matches=(f:File)=>f.name===item.name&&f.size===item.size&&intakeMime(f)===item.mime;
        let file:File|undefined;
        if(attempt.current){
          const index=/^file-(\d+)$/.exec(item.key);file=index?attempt.current.files[Number(index[1])]:undefined;
        }else if(itemFiles[item.id])file=itemFiles[item.id];
        else{
          if(current.items.filter(i=>i.name===item.name&&i.size===item.size&&i.mime===item.mime).length>1)throw new Error(`Use the individual file selector for ${item.key}; these file names, types and sizes are ambiguous.`);
          const index=available.findIndex(matches);if(index>=0)[file]=available.splice(index,1);
        }
        if(!file||!matches(file))throw new Error('Reselect every required file with its original name, type and size, then resume.');
        current=await client.uploadSubmissionItem(token,current.batchId,item.id,file);
        if(!active.current)return;report(current);
        if(current.state!=='open')break;
      }
      if(current.state!=='open'){attempt.current=null;setFiles([]);setItemFiles({});await notify(current);}
    }catch(e){if(active.current){if(beginning&&[400,409].includes(Number((e as {status?:number})?.status)))attempt.current=null;setError(e instanceof Error?e.message:'Upload interrupted. Reopen this case to recover its submission.');}}
    finally{inFlight.current=false;if(active.current)setBusy(false);}
  }
  async function cancel(){
    if(!status||inFlight.current)return;inFlight.current=true;sequence.current++;setBusy(true);setError('');
    try{const next=await client.cancelSubmission(token,status.batchId,caseId);if(active.current){report(next);attempt.current=null;setFiles([]);setItemFiles({});setQuestion('');}}
    catch(e){if(active.current)setError(e instanceof Error?e.message:'Could not cancel submission.');}
    finally{inFlight.current=false;if(active.current)setBusy(false);}
  }
  let message='';
  if(open)message=`${missing.length} ${missing.length===1?'file still':'files still'} required`;
  else if(status?.state==='sealed')message=status.intentState==='enqueued'?'DD queued — see the investigation status below':status.intentState==='failed'?'DD needs operator review':status.intentState==='cancelled'||status.intentState==='superseded'?'This DD request is no longer current':status.intentState==='waiting_dependency'?'Waiting for an approved DD worker':'Submission accepted — waiting for dispatch';
  else if(status?.state==='cancelled')message='Upload cancelled. Original evidence retained.';
  else if(status?.state==='expired')message='Incomplete submission expired. Original evidence retained.';
  return <section aria-label="Document submission" className="space-y-3 border border-[#D4AF37]/20 bg-[#0D0D0D] p-5 text-sm [&_label]:block [&_textarea]:block [&_textarea]:w-full [&_textarea]:min-h-24 [&_textarea]:border [&_textarea]:border-white/20 [&_textarea]:bg-black [&_textarea]:p-3 [&_button]:min-h-11 [&_button]:border [&_button]:border-[#D4AF37]/40 [&_button]:px-4 [&_button]:text-[#E4C45F] [&_button:disabled]:opacity-40 [&_p]:text-[#A59D94]">
    <label htmlFor="case-documents">Case documents</label>
    <input id="case-documents" type="file" accept={INTAKE_ACCEPT} multiple disabled={busy||status?.state==='sealed'} onChange={e=>setFiles(Array.from(e.target.files??[]))}/>
    <p>Up to 20 documents per case; 50 MiB per file. Duplicate bytes are linked without deleting originals.</p>
    <label htmlFor="intake-question">Message the DD agent</label>
    <textarea id="intake-question" value={question} disabled={busy||frozen} onChange={e=>setQuestion(e.target.value)} placeholder="Add questions, background or anything you want investigated…" aria-describedby="intake-question-help"/>
    <p id="intake-question-help">Optional · up to 3,000 characters. Your message accompanies this document submission.</p>
    <label><input type="checkbox" checked={replaceConfirmed} disabled={busy||frozen} onChange={e=>setReplaceConfirmed(e.target.checked)}/>I confirm replacing an active investigation if one exists.</label>
    {message?<p role="status">{message}</p>:null}
    {status?<p>Submission revision: {status.caseRevision}</p>:null}
    {status?.items.length?<ul aria-label="Submission files">{status.items.map(i=><li key={i.id}>{i.name} — {i.state==='verified'?'Bytes verified': 'File required'}{open&&i.state==='pending'&&!attempt.current?<label>Reselect {i.key} — {i.name}<input type="file" accept={INTAKE_ACCEPT} disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)setItemFiles(previous=>({...previous,[i.id]:file}));}}/></label>:null}</li>)}</ul>:null}
    {error?<p role="alert">{error}</p>:null}
    {status?.state==='sealed'?<button type="button" className="secondary" disabled={busy} onClick={()=>{sequence.current++;drafting.current=true;attempt.current=null;report(null);setQuestion('');setFiles([]);setItemFiles({});setReplaceConfirmed(false);setError('');}}>New submission</button>:null}
    {status?.state!=='sealed'?<button type="button" disabled={busy||!loaded} onClick={()=>void submit()}>{busy?'Saving submission…':open?'Resume upload':'Upload & start DD'}</button>:null}
    {open?<button type="button" className="secondary" disabled={busy} onClick={()=>void cancel()}>Cancel incomplete upload</button>:null}
    <p>Verified files seal automatically on the server. You can close the browser after acceptance. Email delivery is paused.</p>
  </section>;
}

