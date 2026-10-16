"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ArrowUp,MessageSquare,ShieldCheck,Paperclip,Plus} from 'lucide-react';

type Message={id:string;role:'user'|'assistant';content:string;status:string;error_code?:string;created_at:string};
type History={messages:Message[];hasMore:boolean;memoryVersion:number;worker:{online:boolean;state:string}};
export async function caseChatRequest(body:Record<string,unknown>){
 const response=await fetch('/api/crm/backend',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'The case conversation could not be loaded.');return data;
}
type Props={caseId?:string;title?:string;draft:string;onDraftChange:(value:string)=>void;attachments:ReactNode;fileCount:number;uploadBusy:boolean;frozen:boolean;onAttach:()=>void;onStart:()=>Promise<void>;onNew:()=>void};
export default function CaseAgentChat({caseId,title,draft,onDraftChange,attachments,fileCount,uploadBusy,frozen,onAttach,onStart,onNew}:Props){
 const [data,setData]=useState<History|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[olderBusy,setOlderBusy]=useState(false),[retryPending,setRetryPending]=useState(false);
 const retry=useRef<{clientKey:string;message:string}|null>(null),sending=useRef(false),alive=useRef(true);
 useEffect(()=>{
  alive.current=true;let reading=false,valid=true;
  if(!caseId)return()=>{alive.current=false;};
  const read=async()=>{
   if(reading)return;reading=true;
   try{const next=await caseChatRequest({action:'chat_history',caseId}) as History;
    if(valid){setData(current=>{
     const loaded=current?.messages||[],first=next.messages[0];
     const prior=first?loaded.filter(m=>m.created_at<first.created_at||(m.created_at===first.created_at&&m.id<first.id)):[];
     return {...next,messages:[...prior,...next.messages],hasMore:prior.length?Boolean(current?.hasMore):next.hasMore};
    });}
   }catch(e){if(valid)setError(e instanceof Error?e.message:'Conversation unavailable.');}finally{reading=false;}
  };
  void read();const timer=setInterval(()=>{if(document.visibilityState==='visible')void read();},5000);
  const visible=()=>{if(document.visibilityState==='visible')void read();};document.addEventListener('visibilitychange',visible);
  return()=>{valid=false;alive.current=false;clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[caseId]);
 const pending=Boolean(data?.messages.some(m=>m.role==='user'&&['queued','processing'].includes(m.status)));
 async function send(){
  if(sending.current||pending||!draft.trim()||!caseId)return;
  if(draft.length>6000){setError('Your message must be no more than 6,000 characters.');return;}
  sending.current=true;setBusy(true);setError('');
  const attempt=retry.current??{clientKey:'chat:'+crypto.randomUUID(),message:draft.trim()};retry.current=attempt;setRetryPending(true);
  try{
   await caseChatRequest({action:'chat_send',caseId,...attempt});
   retry.current=null;setRetryPending(false);
   if(alive.current){onDraftChange('');const next=await caseChatRequest({action:'chat_history',caseId});if(alive.current)setData(next);}
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Message could not be sent. Retry to recover it.');}
  finally{sending.current=false;if(alive.current)setBusy(false);}
 }
 async function older(){
  if(!data?.messages.length||olderBusy)return;setOlderBusy(true);
  try{const page=await caseChatRequest({action:'chat_history',caseId,before:data.messages[0].id});if(alive.current)setData(current=>current?{...current,hasMore:page.hasMore,messages:[...page.messages.filter((m:Message)=>!current.messages.some(x=>x.id===m.id)),...current.messages]}:current);}
  catch(e){if(alive.current)setError(e instanceof Error?e.message:'Earlier messages could not be loaded.');}
  finally{if(alive.current)setOlderBusy(false);}
 }
 const uploading=fileCount>0||frozen;
 return <section aria-label="Integritas DD agent" className="overflow-hidden rounded-2xl border border-[#D4AF37]/25 bg-[#10100F] shadow-xl shadow-black/20 focus-within:border-[#D4AF37]/50">
  <div className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
   <ShieldCheck size={20} className="shrink-0 text-[#D4AF37]" aria-hidden="true" />
   <div className="min-w-0 flex-1"><h2 className="text-sm font-medium text-[#EEE5D3]">Integritas DD agent</h2><p className="mt-1 truncate text-xs text-[#9D968F]">{title||'Your documents. Your questions. One investigation.'}</p></div>
   <button type="button" onClick={onNew} disabled={uploadBusy||busy||frozen} className="inline-flex min-h-11 shrink-0 items-center gap-1 px-1 text-xs text-[#BDA76F] disabled:opacity-40"><Plus size={14} aria-hidden="true" /> New</button>
  </div>
  {attachments}
  {caseId?<>
  <div className="space-y-4 px-4 py-5 sm:px-5">
   {data?.hasMore?<button type="button" disabled={olderBusy} onClick={()=>void older()} className="min-h-11 text-xs text-[#BDA76F]">{olderBusy?'Loading…':'Load earlier messages'}</button>:null}
   {!data?<p role="status" className="text-sm text-[#9D968F]">Loading case conversation…</p>:!data.messages.length?<p className="text-sm leading-6 text-[#9D968F]">Ask about this case, explain your concerns or add context. This conversation stays with the case.</p>:null}
   {data?.messages.map(m=><article key={m.id} className={`max-w-[94%] rounded-2xl px-4 py-3 text-sm leading-6 ${m.role==='user'?'ml-auto bg-[#D4AF37]/10 text-[#EEE5D3]':'mr-auto border border-white/8 bg-[#171715] text-[#DDD4C6]'}`}>
    <p className="mb-1 text-[10px] uppercase tracking-wider text-[#BDA76F]">{m.role==='user'?'You':'DD agent'}</p>
    <p className="whitespace-pre-wrap break-words">{m.content}</p>
    {m.role==='user'&&m.status==='failed'?<p role="status" className="mt-2 text-xs text-[#D9A597]">{m.error_code==='BUDGET_EXHAUSTED'?'The reply budget has been reached. Your message is saved.':'The agent could not finish this reply. Your message is saved; you can send a follow-up.'}</p>:null}
   </article>)}
   {pending?<p role="status" className="flex items-center gap-2 text-xs text-[#BDA76F]"><MessageSquare size={14} aria-hidden="true" />{data?.worker.online?'The agent is reviewing your case and conversation…':'Your message is saved. Waiting for the reply worker to reconnect…'}</p>:null}
  </div>
  </>:null}
  <div className="border-t border-white/8 bg-[#151513] p-4 sm:p-5">
   <label htmlFor="dd-agent-message" className="sr-only">Message the DD agent</label>
   <textarea id="dd-agent-message" aria-describedby="dd-agent-message-help" value={draft} disabled={busy||uploadBusy||frozen||retryPending} onChange={e=>onDraftChange(e.target.value)} rows={3} placeholder="Message the DD agent… Add questions, background or anything you want investigated." className="block min-h-24 w-full resize-y border-0 bg-transparent text-base leading-6 outline-none placeholder:text-[#807B72] disabled:opacity-50" />
   <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
    <button type="button" aria-label="Attach documents" onClick={onAttach} disabled={busy||uploadBusy||frozen||retryPending} className="inline-flex size-11 items-center justify-center rounded-full border border-white/10 text-[#BDA76F] disabled:opacity-40"><Paperclip size={18} aria-hidden="true" /></button>
    <button type="button" onClick={()=>uploading?void onStart():void send()} disabled={busy||uploadBusy||(uploading?retryPending:pending||!draft.trim()||!data||!caseId)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#D4AF37] px-5 py-3 text-sm font-medium text-black disabled:opacity-35">{busy||uploadBusy?'Sending…':uploading?'Send & start investigation':retryPending?'Retry send':caseId?'Send message':'Send & start investigation'}<ArrowUp size={16} aria-hidden="true" /></button>
   </div>
   {error?<p role="alert" className="mt-3 text-xs text-[#D9A597]">{error}</p>:null}
   <p id="dd-agent-message-help" className="mt-3 text-xs leading-5 text-[#807B72]">{uploading||!caseId?'Attach documents to start an investigation. Your message is optional · up to 3,000 characters.':`Message this case · up to 6,000 characters.${data?.memoryVersion?' Case memory is saved.':''} Attach documents to start a new investigation.`}</p>
  </div>
 </section>;
}
