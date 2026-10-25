"use client";
import {useEffect,useRef,useState} from 'react';
import {startVisiblePolling} from '@/lib/visible-polling.mjs';
type Receipt={requestId:string;cleanupState:'pending'|'leased'|'failed'|'complete';pendingDocuments:number};
export default function CaseCleanupStatus({request}:{request:(body:Record<string,unknown>)=>Promise<Record<string,unknown>>}) {
 const [receipts,setReceipts]=useState<Receipt[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const poll=useRef<ReturnType<typeof startVisiblePolling>|null>(null);
 useEffect(()=>{
  let active=true;
  const reader=startVisiblePolling(async()=>{
   const data=await request({action:'purge_list'});
   if(!Array.isArray(data.receipts))throw new Error('File cleanup status is unavailable.');
   if(active){setReceipts(data.receipts);setError('');}
   return data.receipts.some((r:Receipt)=>['pending','leased'].includes(r.cleanupState));
  },{activeDelay:15000,idleDelay:60000,onError:()=>{if(active)setError('File cleanup status could not be refreshed.');}});
  poll.current=reader;void reader.refresh();
  const refresh=()=>{void reader.refresh();};window.addEventListener('integritas-case-purged',refresh);
  return()=>{active=false;reader.stop();poll.current=null;window.removeEventListener('integritas-case-purged',refresh);};
 },[request]);
 const retry=async(r:Receipt)=>{setBusy(true);try{await request({action:'retry_purge_cleanup',requestId:r.requestId});await poll.current?.refresh();}catch{setError('Cleanup could not be retried. The recovery request remains saved.');}finally{setBusy(false);}};
 if(!receipts.length&&!error)return null;
 return <section className="dash-panel p-5 mt-5" aria-label="Evidence file cleanup"><div className="dash-panel-head"><h2>Evidence file cleanup</h2><button className="dash-button" disabled={busy} onClick={()=>void poll.current?.refresh()}>Refresh status</button></div>{error?<p role="alert" className="dash-notice">{error}</p>:null}{receipts.map(r=><div key={r.requestId} className="py-3" role="status"><p>{r.cleanupState==='complete'?'Case and evidence files permanently deleted.':r.cleanupState==='failed'?'Case deleted. Evidence file cleanup needs a retry.':`Case deleted. ${r.pendingDocuments} evidence file${r.pendingDocuments===1?'':'s'} awaiting cleanup.`}</p>{r.cleanupState==='failed'?<button className="dash-button mt-2" disabled={busy} onClick={()=>void retry(r)}>Retry file cleanup</button>:null}</div>)}</section>;
}
