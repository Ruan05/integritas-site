import test from 'node:test';import assert from 'node:assert/strict';
import {interpretSearch,matchesSearch,capacityFor,verifiedIdentityPeers} from '../lib/dashboard-search.mjs';
import {projectDashboard,entityLocation} from '../lib/dashboard-model.mjs';
test('visible deterministic filters preserve unsupported text and separate commercial indicators from risk',()=>{
 const p=interpretSearch('show buyers in Africa priority 1');assert.equal(p.region,'africa');assert.equal(p.role,'buyer');assert.equal(p.priority,'1');assert.equal(p.text,'');
 assert.equal(matchesSearch({name:'Example',country:'Nigeria',marketRole:'buyer',priority:1},p,{prospect:true}),true);
 assert.equal(matchesSearch({name:'Example',country:'Germany',marketRole:'buyer',priority:1},p,{prospect:true}),false);
 assert.equal(matchesSearch({name:'Example',opportunity:100},interpretSearch('low risk'),{prospect:true}),false);
});
test('capacity filters require provenance and comparable units, never mix commodities or periods',()=>{
 const e={id:'e',case_id:'c',identifiers:{capacity:{value:100000,unit:'barrels',period:'day',commodity:'fuel',source_key:'s'}}};const data={sources:[{case_id:'c',source_key:'s'}]};
 assert.equal(capacityFor(e,data).comparableUnit,'bpd');assert.equal(matchesSearch(e,interpretSearch('capacity over 50000 bpd'),{data}),true);
 assert.equal(matchesSearch(e,interpretSearch('over 50000 tonnes/month'),{data}),false);assert.equal(capacityFor(e,{sources:[{case_id:'outside',source_key:'s'}]}),null);
});
test('grouping requires an explicit client association, never a matching name',()=>{
 const cases=[{id:'a',title:'Same',revision:0},{id:'b',title:'Same',revision:0},{id:'c',title:'Same',revision:0}];
 const d=projectDashboard({cases,links:[{case_id:'a',client_id:'client'},{case_id:'b',client_id:'client'}],clients:[{id:'client',name:'Named client'}]});assert.equal(d.clients.length,2);assert.equal(d.clients.find(c=>c.id==='client').cases.length,2);
});
test('unresolved or outside-case coordinate references cannot create evidence-located map pins',()=>{
 const entity={case_id:'a',identifiers:{location:{latitude:0,longitude:0,source_key:'s'}}};
 assert.equal(entityLocation(entity,{sources:[{case_id:'outside',source_key:'s'}]}),null);assert.equal(entityLocation(entity,{sources:[{case_id:'a',source_key:'s'}]}).lat,0);
});
test('identity links require matching registry identifier, jurisdiction, verification and same-case evidence',()=>{
 const a={id:'a',case_id:'ca',entity_type:'company',match_status:'verified',identifiers:{identity:{registration_number:'123',jurisdiction:'ZA',source_key:'s'}}},b={...a,id:'b',case_id:'cb'},data={sources:[{case_id:'ca',source_key:'s'},{case_id:'cb',source_key:'s'}]};
 assert.equal(verifiedIdentityPeers(a,[a,b],data).length,0,'Submitted identifiers cannot acquire verification from an entity-level label');
 a.identifiers.identity={...a.identifiers.identity,scheme:'lei',verification_state:'verified'};b.identifiers={identity:{...a.identifiers.identity}};data.sources=data.sources.map(s=>({...s,evidence_origin:'external_research',verification_state:'claim_supporting'}));
 assert.equal(verifiedIdentityPeers(a,[a,b],data).length,1);
 assert.equal(verifiedIdentityPeers(a,[a,{...b,identifiers:{identity:{...b.identifiers.identity,scheme:'company_registry'}}}],data).length,0,'Different identifier schemes never merge');assert.equal(verifiedIdentityPeers(a,[a,{...b,match_status:'proposed'}],data).length,0);
});
test('unknown risk sorts last in both directions and resolved issues do not inflate rank',async()=>{
 const {compareRisk}=await import('../lib/dashboard-search.mjs');const entities=[{id:'u',display_name:'Unknown'},{id:'h',display_name:'High'},{id:'l',display_name:'Low'}],findings=[{entity_id:'h',materiality:'high'},{entity_id:'l',materiality:'low'},{entity_id:'l',materiality:'critical',resolved:true}];
 assert.deepEqual([...entities].sort((a,b)=>compareRisk(a,b,findings,'low')).map(e=>e.id),['l','h','u']);assert.deepEqual([...entities].sort((a,b)=>compareRisk(a,b,findings,'high')).map(e=>e.id),['h','l','u']);
});
