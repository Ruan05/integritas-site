'use client';
import {capacityFor,evidenceReference,factQualification} from '@/lib/dashboard-search.mjs';
import {entityLocation} from '@/lib/dashboard-model.mjs';
type Row=Record<string,any>;
export default function EntityEvidenceFacts({entity,data}:{entity:Row;data:Row}){
 const ids=entity.identifiers||{},location=entityLocation(entity,data),capacity=capacityFor(entity,data);
 const fields:Array<{label:string;value:string;fact:Row}>=[];
 if(location)fields.push({label:'Recorded coordinates',value:`${location.lat}, ${location.lon}`,fact:ids.location||ids.geolocation||ids});
 if(capacity)fields.push({label:'Reported capacity',value:`${capacity.value.toLocaleString()} ${capacity.unit}/${capacity.period} · ${capacity.commodity}`,fact:ids.capacity});
 if(ids.identity&&evidenceReference(entity,ids.identity,data))fields.push({label:ids.identity.scheme==='lei'?'Legal entity identifier':'Registration identifier',value:`${ids.identity.registration_number} · ${ids.identity.jurisdiction}`,fact:ids.identity});
 if(typeof ids.market_role==='string'&&evidenceReference(entity,ids.market_role_provenance,data))fields.push({label:'Reported market role',value:ids.market_role,fact:ids.market_role_provenance});
 const raw=Object.values(ids).filter((v:any)=>v&&typeof v==='object'&&typeof v.scheme==='string'&&typeof v.value==='string') as Row[];
 return <section className="entity-source-facts" aria-label="Source-supported details">
  {!fields.length&&!raw.length?<p className="dash-muted">No source-supported identifiers, coordinates or capacity recorded.</p>:null}
  {fields.map(({label,value,fact})=>{const source=evidenceReference(entity,fact,data);return <article key={label} className="entity-source-fact"><h4>{label}</h4><p>{value}</p><small>{factQualification(entity,fact,data)}</small>{typeof fact.quote==='string'?<blockquote>{fact.quote}</blockquote>:null}<p className="dash-muted">Source: {source?.title||source?.name||'Case evidence'}{source?.page_reference?` · ${source.page_reference}`:''}</p>{source?.url?.startsWith('https://')?<a href={source.url} target="_blank" rel="noopener noreferrer">Open source</a>:null}</article>;})}
  {raw.map((id,n)=><p key={n}>{id.scheme}: {id.value} <small className="dash-muted">· {id.verified===true?'Source verification recorded; see evidence':'Submitted identifier'}</small></p>)}
  {Array.isArray(ids.dashboard_conflicts)&&ids.dashboard_conflicts.length?<p className="dash-alert" role="status">Conflicting {ids.dashboard_conflicts.filter((v:unknown)=>typeof v==='string').slice(0,4).join(', ')} statements remain unresolved. Review the source timeline before relying on a value.</p>:null}
 </section>;
}
