/** Deterministic interpretation, with the parsed filters visible and editable in the UI. */
const REGIONS={africa:['africa','south africa','nigeria','ghana','kenya','angola','egypt','morocco','algeria','namibia','zambia','tanzania','uganda','mozambique','senegal','ivory coast','côte d’ivoire'],europe:['europe','united kingdom','uk','germany','france','netherlands','switzerland','spain','italy','greece','portugal','belgium','norway','sweden','poland','romania'],asia:['asia','china','india','singapore','japan','indonesia','malaysia','thailand','vietnam','philippines','pakistan','bangladesh','south korea'],america:['america','usa','united states','canada','brazil','argentina','mexico','chile','colombia','peru'],'middle east':['middle east','uae','united arab emirates','saudi arabia','oman','qatar','bahrain','kuwait','iraq','jordan']};
export function regionMatches(value,region){const hay=String(value||'').toLowerCase();return region==='all'||(REGIONS[region.toLowerCase()]||[region.toLowerCase()]).some(term=>hay.includes(term));}
export function interpretSearch(input){
 let text=String(input||'').trim();const parsed={text:'',region:'all',role:'all',risk:'all',priority:'all',capacity:null,unsupported:[]};
 const take=(pattern,apply)=>{text=text.replace(pattern,(...m)=>{apply(m);return ' ';});};
 take(/\b(?:in\s+)?(south africa|united kingdom|middle east|africa|europe|asia|america)\b/ig,m=>parsed.region=m[1].toLowerCase());
 take(/\b(buyers?|sellers?)\b/ig,m=>parsed.role=m[1].toLowerCase().startsWith('buy')?'buyer':'seller');
 take(/\b(?:priority\s*|p)([123])\b/ig,m=>parsed.priority=m[1]);
 take(/\b(critical|high|medium|low)\s+risk\b/ig,m=>parsed.risk=m[1].toLowerCase());
 take(/\b(?:capacity\s*)?(?:over|above|at least|>=)\s*([\d,.]+)\s*(bpd|mtpa|tonnes?\/month|barrels?\/day)\b/ig,m=>parsed.capacity={min:Number(m[1].replaceAll(',','')),unit:m[2].toLowerCase().replace(/^barrels?\/day$/,'bpd').replace(/^tonnes?\/month$/,'tonnes/month')});
 text=text.replace(/\b(?:show|find|me|all|with|and|the|companies|company|prospects)\b/ig,' ');
 parsed.text=text.trim().replace(/\s+/g,' ');return parsed;
}
export function searchInterpretation(p){const parts=[p.text?`Text: “${p.text}”`:'Any name',p.region!=='all'?`Region: ${p.region}`:'',p.role!=='all'?`Role: ${p.role}`:'',p.risk!=='all'?`Risk: ${p.risk}`:'',p.priority!=='all'?`Priority: ${p.priority}`:'',p.capacity?`Capacity ≥ ${p.capacity.min.toLocaleString()} ${p.capacity.unit}`:''];return parts.filter(Boolean).join(' · ');}
export function evidenceReference(entity,value,data){
 if(!value||typeof value!=='object')return null;
 return (data.sources||[]).find(s=>s.case_id===entity.case_id&&(!entity.case_job_id||s.case_job_id===entity.case_job_id)&&((value.source_id&&s.id===value.source_id)||(value.source_key&&s.source_key===value.source_key)||(value.source_url&&s.url===value.source_url)))||
  (data.documents||[]).find(d=>d.case_id===entity.case_id&&value.evidence_id===d.id&&/^[a-f\d]{64}$/i.test(d.sha256||''))||null;
}
export function capacityFor(entity,data){
 const c=entity.identifiers?.capacity;if(!c||typeof c!=='object'||!Number.isFinite(c.value)||c.value<0||!c.unit||!c.period||!c.commodity)return null;
 const source=evidenceReference(entity,c,data);if(!source)return null;
 return {...c,source,comparableUnit:c.unit==='barrels'&&c.period==='day'?'bpd':c.unit==='tonnes'&&c.period==='year'?'mtpa':c.unit==='tonnes'&&c.period==='month'?'tonnes/month':`${c.unit}/${c.period}`,comparableValue:c.unit==='tonnes'&&c.period==='year'?c.value/1e6:c.value};
}
export function riskFor(entity,findings){const ranks=['informational','low','medium','high','critical'];const related=findings.filter(f=>f.entity_id===entity.id&&f.resolved!==true);const rank=Math.max(-1,...related.map(f=>ranks.indexOf(f.materiality)));return rank<0?'unknown':ranks[rank];}
export function matchesSearch(row,p,{data={},prospect=false}={}){
 const hay=[row.display_name||row.name,...(row.aliases||[]),row.country,row.role,row.offering,JSON.stringify(row.identifiers||{})].filter(Boolean).join(' ').toLowerCase();
 if(p.text.toLowerCase().split(/\s+/).filter(Boolean).some(word=>!hay.includes(word)))return false;
 if(!regionMatches(hay,p.region)||p.role!=='all'&&(row.marketRole||row.identifiers?.market_role)!==p.role||p.priority!=='all'&&String(row.priority)!==p.priority)return false;
 // Historical opportunity and completeness indicators never become risk or match-confidence scores.
 if(p.risk!=='all'&&(prospect||riskFor(row,data.findings||[])!==p.risk))return false;
 if(p.capacity){const c=capacityFor(row,data);if(!c||c.comparableUnit!==p.capacity.unit||c.comparableValue<p.capacity.min)return false;}
 return true;
}
export function verifiedIdentityPeers(entity,entities,data){
 const identity=entity.identifiers?.identity;
 if(entity.match_status!=='verified'||!identity?.registration_number||!identity?.jurisdiction||!evidenceReference(entity,identity,data))return [];
 return entities.filter(other=>other.id!==entity.id&&other.match_status==='verified'&&other.entity_type===entity.entity_type&&other.identifiers?.identity?.registration_number===identity.registration_number&&other.identifiers?.identity?.jurisdiction===identity.jurisdiction&&evidenceReference(other,other.identifiers.identity,data));
}
