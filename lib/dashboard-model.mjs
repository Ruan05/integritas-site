import {evidenceReference} from './dashboard-search.mjs';
/** Pure projections: never fabricate a rating, location, completion or identity merge. */
export const GATES=[
 ['G01','Legal identity & authority','Official registration and authority to act'],
 ['G02','Beneficial ownership','Ownership chain and beneficial-owner evidence'],
 ['G03','Regulatory register','Relevant regulator and licence evidence'],
 ['G04','Banking verification','Independent bank and account-holder authentication'],
 ['G05','Supply authority','Evidence of the seller’s supply mandate'],
 ['G06','Terminal & cargo','Independent terminal, inventory and cargo confirmation'],
 ['G07','Origin & sanctions','Origin evidence and identity-resolved screening'],
 ['G08','Commercial contract','Agreed terms and enforceable signing authority'],
 ['G09','Document & channel authentication','Independent verification of documents and channels'],
 ['G10','Credit','Evidence-backed financial and credit review'],
 ['G11','Operational substance','Verified operating presence and capabilities'],
 ['G12','Human decision','Named reviewer’s decision with supporting evidence'],
].map(([id,title,acceptance])=>({id,title,acceptance}));
export const humanize=value=>String(value||'Not assessed').replaceAll('_',' ');
export const recordFor=(data,caseId,key)=>(data?.records||[]).find(r=>r.case_id===caseId&&r.record_key===key);
export const ddTime=row=>row.latest_job?.updated_at||row.latest_job?.created_at||null;
export function projectDashboard(data={}){
 const current=new Map((data.cases||[]).map(c=>[c.id,c.revision]));
 const rows=key=>(data[key]||[]).filter(r=>current.has(r.case_id)&&(r.case_revision==null||r.case_revision===current.get(r.case_id)));
 const jobs=rows('jobs').filter(j=>['openclaw-oracle','ruan-native'].includes(j.runtime_provider));
 const entities=rows('entities').map(e=>({...e,kind:e.entity_type==='person'?'people':['company','organization','bank','legal_entity'].includes(e.entity_type)?'companies':'other'}));
 const cases=(data.cases||[]).map(c=>{
  const latest_job=jobs.filter(j=>j.case_id===c.id).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))||b.id.localeCompare(a.id))[0]||null;
  const report=(data.reports||[]).filter(r=>r.case_id===c.id&&r.case_job_id===latest_job?.id&&r.based_on_revision===c.revision).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)))[0]||null;
  const gates=GATES.map(g=>{const saved=recordFor(data,c.id,'gate:'+g.id);const current=saved?.case_revision===c.revision;return {...g,record:saved,status:current?saved.payload.status:'open',historical:!!saved&&!current};});
  const findings=rows('findings').filter(f=>f.case_id===c.id).map(f=>{const saved=recordFor(data,c.id,'finding:'+f.id);return {...f,resolved:saved?.case_revision===c.revision&&saved?.payload.resolved===true};});
  const severe=findings.some(f=>!f.resolved&&['critical','high'].includes(String(f.materiality).toLowerCase()));
  return {...c,latest_job,latest_report:report,gates,findings,document_count:(data.documents||[]).filter(d=>d.case_id===c.id).length,
   held:severe||/\bHOLD\b/.test(report?.summary||''),openGates:gates.filter(g=>g.status!=='accepted').length,
   completed:latest_job?.stage==='completed'&&report?.status==='finalized'&&report?.finalization_method==='automated_independent_review'&&(latest_job.runtime_provider==='ruan-native'||(data.pairs||[]).some(p=>p.report_id===report.id&&p.case_id===c.id&&p.case_job_id===latest_job.id&&p.case_revision===c.revision&&p.report_model_sha256===report.report_model_sha256&&/^[a-f0-9]{64}$/.test(p.external_sha256)&&/^[a-f0-9]{64}$/.test(p.internal_sha256)&&p.external_sha256!==p.internal_sha256)),
   clientId:(data.links||[]).find(l=>l.case_id===c.id)?.client_id||c.id};
 }).sort((a,b)=>String(ddTime(b)||'').localeCompare(String(ddTime(a)||''))||String(b.created_at).localeCompare(String(a.created_at))||a.id.localeCompare(b.id));
 const clients=[...new Set(cases.map(c=>c.clientId))].map(id=>{
  const members=cases.filter(c=>c.clientId===id),head=members[0],client=(data.clients||[]).find(c=>c.id===id);
  return {...head,id,caseId:head.id,title:client?.name||head.title,cases:members,document_count:members.reduce((n,c)=>n+c.document_count,0),openGates:members.reduce((n,c)=>n+c.openGates,0),held:members.some(c=>c.held),completed:members.every(c=>c.completed)};
 });
 // Same-name records are deliberately not merged without a canonical verified identifier.
 return {...data,cases,clients,entities,relationships:rows('relationships'),findings:cases.flatMap(c=>c.findings),checks:rows('checks'),sources:rows('sources'),jobs,
   stats:{cases:cases.length,openGates:cases.reduce((n,c)=>n+c.openGates,0),holds:cases.filter(c=>c.held).length,contacts:entities.length},
   recent:cases.filter(c=>c.latest_job).slice(0,3)};
}
export function entityLocation(entity,data){
 const obj=entity.identifiers||{};const loc=obj.location||obj.geolocation||obj;
 const lat=Number(loc.latitude),lon=Number(loc.longitude);
 if(loc.latitude==null||loc.longitude==null||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
 if(!data||!evidenceReference(entity,loc,data))return null;
 return {lat,lon,source:loc.source_id||loc.source_key||loc.source_url||loc.evidence_id,precision:loc.precision||'unspecified',observedAt:loc.observed_at||null};
}
export function matchesEntity(entity,query,kind='all',region='all'){
 const text=[entity.display_name,...(entity.aliases||[]),JSON.stringify(entity.identifiers||{})].join(' ').toLowerCase();
 return (kind==='all'||entity.kind===kind)&&(region==='all'||text.includes(region.toLowerCase()))&&query.toLowerCase().split(/\s+/).filter(Boolean).every(w=>text.includes(w));
}
export function downloadCsv(filename,rows){
 const esc=v=>'"'+String(v??'').replace(/"/g,'""').replace(/^([=+@\-\t\r])/,'\'$1')+'"';
 const text=rows.map(r=>r.map(esc).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob(['\ufeff'+text],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
