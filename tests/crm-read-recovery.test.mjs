import test from 'node:test';
import assert from 'node:assert/strict';
import {clearRecoveredReadError,readWithRetry} from '../lib/crm-read-recovery.mjs';

test('a transient fetch failure is retried and returns the recovered read',async()=>{
 let calls=0;
 const result=await readWithRetry(async()=>{
  calls++;
  if(calls===1)throw new TypeError('Failed to fetch');
  return {cases:[]};
 },{sleep:async()=>{}});
 assert.deepEqual(result,{cases:[]});
 assert.equal(calls,2);
});

test('a transient backend gateway response is retried, but client errors are not',async()=>{
 let calls=0;
 await readWithRetry(async()=>{
  calls++;
  if(calls===1)throw Object.assign(new Error('Gateway unavailable'),{status:503});
  return true;
 },{sleep:async()=>{}});
 assert.equal(calls,2);

 calls=0;
 await assert.rejects(readWithRetry(async()=>{
  calls++;
  throw Object.assign(new Error('Invalid request'),{status:400});
 },{sleep:async()=>{}}),/Invalid request/);
 assert.equal(calls,1);
});

test('a recovered read clears only its own stale fetch error',()=>{
 assert.equal(clearRecoveredReadError('The case conversation service could not complete the request.','read'),'');
 assert.equal(clearRecoveredReadError('Message could not be sent.','action'),'Message could not be sent.');
 assert.equal(clearRecoveredReadError('Failed to fetch','action'),'Failed to fetch');
});
