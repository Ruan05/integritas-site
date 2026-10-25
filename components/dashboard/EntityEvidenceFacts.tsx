'use client';
import {capacityFor,evidenceReference,factQualification} from '@/lib/dashboard-search.mjs';
import {entityLocation} from '@/lib/dashboard-model.mjs';
type Row=Record<string,unknown>;
interface EntityRow extends Row {
  identifiers?: Record<string, unknown>;
  location?: {lat: number; lon: number};
  geolocation?: {lat: number; lon: number};
  capacity?: {value: number; unit: string; period: string; commodity: string} | unknown;
  identity?: {scheme: string; registration_number: string; jurisdiction: string};
  market_role?: string;
  market_role_provenance?: unknown;
  dashboard_conflicts?: unknown[];
}
export default function EntityEvidenceFacts({entity,data}:{entity:EntityRow;data:Row}){
 const ids=entity.identifiers||{},location=entityLocation(entity,data),capacity=capacityFor(entity,data);
 const fields:Array<{label:string;value:string;fact:object}>=[];
 if(location)fields.push({label:'Recorded coordinates',value:`${location.lat}, ${location.lon}`,fact:ids.location||ids.geolocation||ids});
 if(capacity)fields.push({label:'Reported capacity',value:`${capacity.value.toLocaleString()} ${capacity.unit}/${capacity.period} · ${capacity.commodity}`,fact:ids.capacity});
 if(ids.identity&&evidenceReference(entity,ids.identity,data))fields.push({label:ids.identity.scheme==='lei'?'Legal entity identifier':'Registration identifier',value:`${ids.identity.registration_number} · ${ids.identity.jurisdiction}`,fact:ids.identity});
 if(typeof ids.market_role==='string'&&evidenceReference(entity,ids.market_role_provenance,data))fields.push({label:'Reported market role',value:ids.market_role,fact:ids.market_role_provenance as object});
 const raw=Object.values(ids).filter((v:unknown)=>v&&typeof v==='object'&&typeof (v as Record<string,unknown>).scheme==='string'&&typeof (v as Record<string,unknown>).value==='string') as Row[];
 return <section className="entity-source-facts" aria-label="Source-supported details">
  {!fields.length&&!raw.length?<p className="dash-muted">No source-supported identifiers, coordinates or capacity recorded.</p>:null}
  {fields.map(({label,value,fact})=>{const source=evidenceReference(entity,fact,data);return <article key={label} className="entity-source-fact"><h4>{label}</h4><p>{value}</p><small>{factQualification(entity,fact,data)}</small>{typeof (fact as Record<string,unknown>).quote==='string'?<blockquote>{(fact as Record<string,unknown>).quote as string}</blockquote>:null}<p className="dash-muted">Source: {source?.title||source?.name||'Case evidence'}{source?.page_reference?` · ${source.page_reference}`:''}</p>{source?.url?.startsWith('https://')?<a href={source.url} target="_blank" rel="noopener noreferrer">Open source</a>:null}</article>;})}
  {raw.map((id,n)=><p key={n}>{id.scheme}: {id.value} <small className="dash-muted">· {id.verified===true?'Source verification recorded; see evidence':'Submitted identifier'}</small></p>)}
  {Array.isArray(ids.dashboard_conflicts)&&ids.dashboard_conflicts.length?<p className="dash-alert" role="status">Conflicting {ids.dashboard_conflicts.filter((v:unknown)=>typeof v==='string').slice(0,4).join(', ')} statements remain unresolved. Review the source timeline before relying on a value.</p>:null}
 </section>;
}
