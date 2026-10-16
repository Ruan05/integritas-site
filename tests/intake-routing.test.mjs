import test from 'node:test';
import assert from 'node:assert/strict';
import {hasActiveCaseInvestigation, resolveCaseSubmissionTarget} from '../lib/intake-routing.mjs';

test('document submission reuses only the selected case unless new-case mode is active',()=>{
  const snapshot={case:{id:'case-1',revision:7}};
  assert.deepEqual(resolveCaseSubmissionTarget({newCaseMode:false,activeCaseId:'case-1',snapshot}),{caseId:'case-1',caseRevision:7});
  assert.equal(resolveCaseSubmissionTarget({newCaseMode:true,activeCaseId:'case-1',snapshot}),null);
  assert.equal(resolveCaseSubmissionTarget({newCaseMode:false,activeCaseId:'case-2',snapshot}),null);
  assert.equal(resolveCaseSubmissionTarget({newCaseMode:false,activeCaseId:'case-1',snapshot:{case:{id:'case-1',revision:NaN}}}),null);
});

test('paused and other nonterminal DD jobs require replacement confirmation',()=>{
  for(const stage of ['queued','researching','paused']) {
    assert.equal(hasActiveCaseInvestigation({jobs:[{stage}]}),true,`${stage} is active`);
  }
  for(const stage of ['completed','cancelled','failed','incomplete','research_limit_reached']) {
    assert.equal(hasActiveCaseInvestigation({jobs:[{stage}]}),false,`${stage} is terminal`);
  }
  assert.equal(hasActiveCaseInvestigation({jobs:[]}),false);
});
