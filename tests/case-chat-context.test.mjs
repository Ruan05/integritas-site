import test from 'node:test';
import assert from 'node:assert/strict';
import {buildConversationContext, caseScopedRows, caseWithConversationContext, selectDocumentContext, sanitizePublicSourceUrl, boundText} from '../supabase/functions/_shared/case-chat-context.mjs';

test('selects passages relevant to the user question while preserving case document identity', async () => {
  const text = `${'Generic administrative language. '.repeat(80)}\nBeneficiary account holder: Meridian Trade Ltd.\n${'Footer terms. '.repeat(80)}`;
  const result = selectDocumentContext([
    {id: 'doc-1', name: 'Invoice A', sha256: 'a', extracted_text: 'Payment terms say 30 days. '.repeat(100)},
    {id: 'doc-2', name: 'Invoice B', sha256: 'b', extracted_text: text},
  ], 'Who is the beneficiary account holder?', {maxTotalChars: 800, maxPerDocument: 400});
  assert.equal(result.items.length, 2);
  assert.equal(result.items[1].id, 'doc-2');
  assert.match(result.items[1].extracted_text, /Beneficiary account holder/);
  assert.ok(result.items.reduce((sum, row) => sum + row.extracted_text.length, 0) <= 800);
  assert.equal(result.items[0].text_is_excerpt, true);
  assert.equal(result.omitted_count, 0);
});

test('bounds overlong source records and strips credential-bearing URL components', async () => {
  const text = boundText('x'.repeat(100), 12);
  assert.equal(text.length, 12);
  assert.match(text, /truncated/);
  assert.equal(sanitizePublicSourceUrl('https://user:pass@example.org/report?api_key=abc&page=2#secret'), 'https://example.org/report?page=2');
  assert.equal(sanitizePublicSourceUrl('javascript:alert(1)'), null);
  assert.equal(sanitizePublicSourceUrl('http://127.0.0.1/admin'), null);
});

test('rejects rows outside the authorized case instead of serializing cross-case context', async () => {
  assert.deepEqual(caseScopedRows([{case_id: 'case-1', id: 'a'}], 'case-1'), [{case_id: 'case-1', id: 'a'}]);
  assert.throws(() => caseScopedRows([{case_id: 'case-2', id: 'other'}], 'case-1'), /case scope/);
});

test('nests bounded conversation context in the case object consumed by the Oracle bridge', () => {
  const caseRecord = caseWithConversationContext({id: 'case-1', investigation_context: {schema_version: 'case-chat-context-v2'}}, 'bounded prior case history');
  assert.equal(caseRecord.id, 'case-1');
  assert.equal(caseRecord.conversation_context, 'bounded prior case history');
  assert.equal(caseRecord.investigation_context.schema_version, 'case-chat-context-v2');
});

test('carries question-relevant prior turns within the existing intake context limit', () => {
  const rows = Array.from({length: 20}, (_, i) => ({
    id: `message-${i}`, role: i % 2 ? 'assistant' : 'user',
    content: i === 2 ? 'The regulator filing for Meridian Trade is still unverified.' : `Unrelated update ${i}.`,
    created_at: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
  }));
  const context = buildConversationContext({summary: 'Earlier case memory.'}, rows, 'What did we find about the regulator filing?', 1200);
  assert.match(context, /Earlier case memory/);
  assert.match(context, /regulator filing for Meridian Trade/);
  assert.ok(context.length <= 1200);
  assert.match(context, /UNVERIFIED/);
});
