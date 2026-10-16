import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

const root = process.cwd();
const vite = await createServer({
  appType: 'custom', configFile: false, root,
  resolve: {alias: {'@': root}}, server: {middlewareMode: true},
});
after(() => vite.close());

test('a typed request or link becomes a supported text evidence item for full DD', async () => {
  const {buildFullDDSubmissionFiles} = await vite.ssrLoadModule('/lib/intake-browser.ts');
  const files = buildFullDDSubmissionFiles([], 'Investigate https://example.org/company/123');
  assert.equal(files.length, 1);
  assert.equal(files[0].name, 'dd-brief.txt');
  assert.equal(files[0].type, 'text/plain');
  assert.equal(await files[0].text(), 'Investigate https://example.org/company/123');
});

test('uploaded evidence is kept as selected and does not create a duplicate brief', async () => {
  const {buildFullDDSubmissionFiles} = await vite.ssrLoadModule('/lib/intake-browser.ts');
  const selected = new File(['invoice'], 'invoice.txt', {type: 'text/plain'});
  assert.deepEqual(buildFullDDSubmissionFiles([selected], 'Review this invoice'), [selected]);
});

test('full DD without files requires a nonblank brief and enforces the brief limit', async () => {
  const {buildFullDDSubmissionFiles} = await vite.ssrLoadModule('/lib/intake-browser.ts');
  assert.throws(() => buildFullDDSubmissionFiles([], '  '), /Enter a DD brief/);
  assert.throws(() => buildFullDDSubmissionFiles([], 'x'.repeat(3001)), /3,000 characters/);
});

test('an existing case with evidence can start a question-only revision without adding a document', async () => {
  const {buildQuestionOnlyRevisionRequest} = await vite.ssrLoadModule('/lib/intake-browser.ts');
  const request = buildQuestionOnlyRevisionRequest({
    caseId: 'case-1', caseRevision: 7, clientKey: 'intake:request-1234',
    question: 'Review the ownership chain', context: 'Earlier source review: https://example.org/register',
    replaceConfirmed: true,
  });
  assert.deepEqual(request, {
    action: 'start_question_only_revision', caseId: 'case-1', caseRevision: 7,
    clientKey: 'intake:request-1234', question: 'Review the ownership chain',
    context: 'Earlier source review: https://example.org/register', replaceConfirmed: true,
  });
});

test('question-only revisions enforce the same brief, context, idempotency and case revision bounds', async () => {
  const {buildQuestionOnlyRevisionRequest} = await vite.ssrLoadModule('/lib/intake-browser.ts');
  const base = {caseId:'case-1',caseRevision:1,clientKey:'intake:request-1234',question:'Check the company',context:'',replaceConfirmed:false};
  assert.throws(() => buildQuestionOnlyRevisionRequest({...base,caseId:''}), /case/);
  assert.throws(() => buildQuestionOnlyRevisionRequest({...base,caseRevision:-1}), /revision/);
  assert.throws(() => buildQuestionOnlyRevisionRequest({...base,clientKey:'short'}), /idempotency key/);
  assert.throws(() => buildQuestionOnlyRevisionRequest({...base,question:'x'.repeat(3001)}), /3,000 characters/);
  assert.throws(() => buildQuestionOnlyRevisionRequest({...base,context:'x'.repeat(6001)}), /6,000 characters/);
});

test('question-only revision requires at least one SHA-verified case document', async () => {
  const {hasVerifiedCaseEvidence} = await vite.ssrLoadModule('/lib/intake-browser.ts');
  assert.equal(hasVerifiedCaseEvidence([{sha256:'a'.repeat(64)}]), true);
  assert.equal(hasVerifiedCaseEvidence([{sha256:'pending'}]), false);
  assert.equal(hasVerifiedCaseEvidence([]), false);
});

test('case chat keeps Send message separate from Run full DD', async () => {
  const {default: CaseAgentChat} = await vite.ssrLoadModule('/components/CaseAgentChat.tsx');
  const html = renderToStaticMarkup(React.createElement(CaseAgentChat, {
    caseId: 'case-1', title: 'Invoice review', draft: 'Check this link', onDraftChange() {},
    attachments: null, fileCount: 0, uploadBusy: false, frozen: false,
    onAttach() {}, async onStart() {}, onNew() {},
  }));
  assert.match(html, />Send message</);
  assert.match(html, />Run full DD</);
  assert.match(html, /Send a question for a researched reply/);
});
