import assert from 'node:assert/strict';
import test from 'node:test';
import {storedAssistantReply} from '../lib/stored-chat-reply.mjs';

test('separates an old incomplete appended response envelope from its readable answer', () => {
  const original = 'The filing is unverified.\n\n{"reply":"The filing is unverified.","memory":';
  assert.deepEqual(storedAssistantReply(original), {
    text: 'The filing is unverified.', original,
  });
});

test('preserves ordinary prose, evidence JSON and quoted transport examples', () => {
  for (const text of ['The invoice contains {"amount":42}.',
    'The API uses a reply and memory object.',
    'Example:\n```json\n{"reply":"example","memory":\n```',
    'Quoted example.\n~~~json\n{"reply":"example","memory":',
    'Context.\n{"reply":"answer","memory":{}}\nThis following evidence matters.',
    'Context.\n{"reply":"answer","memory":{}}',
    'Example inline: {"reply":"example","memory":']) {
    assert.deepEqual(storedAssistantReply(text), {text, original: null});
  }
});

test('does not rewrite a response when the suspicious suffix lacks a readable prefix', () => {
  const text = '{"reply":"example","memory":';
  assert.deepEqual(storedAssistantReply(text), {text, original: null});
});
