import test from 'node:test';
import assert from 'node:assert/strict';
import {projectDashboard,entityLocation,matchesEntity} from '../lib/dashboard-model.mjs';
test('DD ordering uses current investigation events, not later unrelated case edits',()=>{
 const data=projectDashboard({cases:[{id:'a',title:'A',revision:2,created_at:'2026-01-01',updated_at:'2026-12-01'},{id:'b',title:'B',revision:1,created_at:'2026-01-01'}],jobs:[{id:'a0',case_id:'a',case_revision:1,created_at:'2026-11-01',updated_at:'2026-11-01',runtime_provider:'ruan-native'},{id:'a1',case_id:'a',case_revision:2,created_at:'2026-10-01',updated_at:'2026-10-01',runtime_provider:'ruan-native'},{id:'b1',case_id:'b',case_revision:1,created_at:'2026-10-02',updated_at:'2026-10-02',runtime_provider:'ruan-native'}]});
 assert.equal(data.recent[0].id,'b');assert.equal(data.cases.find(c=>c.id==='a').latest_job.id,'a1');
});
test('old acceptance and finding resolution do not silently clear a new revision',()=>{
 const data=projectDashboard({cases:[{id:'a',title:'A',revision:2}],records:[{case_id:'a',record_key:'gate:G01',case_revision:1,payload:{status:'accepted'}},{case_id:'a',record_key:'finding:f',case_revision:1,payload:{resolved:true}}],findings:[{id:'f',case_id:'a',case_revision:2,materiality:'critical'}]});
 assert.equal(data.cases[0].gates[0].status,'open');assert.equal(data.cases[0].findings[0].resolved,false);assert.equal(data.stats.holds,1);
});
test('same-name entities are retained separately and coordinates require a source',()=>{
 const data=projectDashboard({cases:[{id:'a',title:'A',revision:1}],entities:[{id:'e1',case_id:'a',display_name:'Example',entity_type:'company'},{id:'e2',case_id:'a',display_name:'Example',entity_type:'person'}]});
 assert.equal(data.entities.length,2);assert.equal(entityLocation({identifiers:{latitude:0,longitude:0}}),null);
 assert.deepEqual(entityLocation({case_id:'a',identifiers:{latitude:0,longitude:0,source_id:'s'}},{sources:[{id:'s',case_id:'a'}]}),{lat:0,lon:0,source:'s',precision:'unspecified',observedAt:null});
 assert.equal(entityLocation({identifiers:{latitude:100,longitude:0,source_id:'s'}}),null);
 assert.equal(matchesEntity({...data.entities[0],aliases:['Trading alias']},'trading alias','companies'),true);
});
test('a completed job alone cannot produce a finalized report claim',()=>{
 const data=projectDashboard({cases:[{id:'a',title:'A',revision:1}],jobs:[{id:'j',case_id:'a',case_revision:1,runtime_provider:'ruan-native',stage:'completed'}],reports:[{id:'r',case_id:'a',case_job_id:'old',based_on_revision:1,status:'finalized'}]});
 assert.equal(data.cases[0].completed,false);
});
test('case-list fallback defines every collection before the dashboard snapshot arrives',()=>{
 const data=projectDashboard({cases:[{id:'new-case',title:'New client',revision:0}]});
 for(const key of ['archivedCases','documents','records','links','history','preferences','sources','relationships','findings','checks','jobs','pairs','prospects'])assert.equal(Array.isArray(data[key]),true,key+' must be a collection during initial/deep-link load');
 assert.equal(data.documents.filter(d=>d.case_id==='new-case').length,0);assert.equal(data.cases[0].gates.length,12);
});
test('CSV exports quote content and neutralize formula prefixes including leading whitespace',async()=>{
 const {serializeCsv}=await import('../lib/dashboard-model.mjs');const csv=serializeCsv([['Name','Value'],['Example, quoted',' =HYPERLINK("https://example.org")'],['Plain','100']]);
 assert.match(csv,/"Example, quoted","' =HYPERLINK\(""https:\/\/example.org""\)"/);assert.match(csv,/"Plain","100"/);
});
