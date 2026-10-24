"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';

export function useConfirmation(){
 const [request,setRequest]=useState<{title:string;message:string;typed?:string}|null>(null),[value,setValue]=useState('');
 const resolver=useRef<((accepted:boolean)=>void)|null>(null);
 const finish=useCallback((accepted:boolean)=>{resolver.current?.(accepted);resolver.current=null;setRequest(null);setValue('');},[]);
 const confirm=useCallback((title:string,message:string,typed?:string)=>new Promise<boolean>(resolve=>{resolver.current?.(false);resolver.current=resolve;setValue('');setRequest({title,message,typed});}),[]);
 useEffect(()=>()=>{resolver.current?.(false);},[]);
 const dialog=<Dialog open={!!request} onOpenChange={open=>!open&&finish(false)}><DialogContent className="dash-dialog"><DialogHeader><DialogTitle>{request?.title}</DialogTitle><DialogDescription>{request?.message}</DialogDescription></DialogHeader>{request?.typed?<label className="dash-field">Type {request.typed} to continue<input autoComplete="off" value={value} onChange={e=>setValue(e.target.value)}/></label>:null}<div className="folder-dialog-actions"><button className="dash-button" onClick={()=>finish(false)}>Keep current state</button><button className="dash-button primary" disabled={!!request?.typed&&value!==request.typed} onClick={()=>finish(true)}>Confirm</button></div></DialogContent></Dialog>;
 return {confirm,dialog};
}
