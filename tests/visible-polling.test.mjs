import assert from 'node:assert/strict';
import test from 'node:test';
import {startVisiblePolling} from '../lib/visible-polling.mjs';

function clock() {
  let nextId = 0;
  const scheduled = new Map();
  return {
    scheduled,
    schedule(fn, delay) { const id = ++nextId; scheduled.set(id, {fn, delay}); return id; },
    cancel(id) { scheduled.delete(id); },
    async tick() { const [id, job] = scheduled.entries().next().value; scheduled.delete(id); await job.fn(); },
  };
}

test('uses fast polling while work is pending and slows after completion', async () => {
  const timer = clock(); let active = true;
  const poll = startVisiblePolling(async () => active, {...timer, isVisible: () => true, activeDelay: 5000, idleDelay: 30000});
  await poll.refresh();
  assert.equal([...timer.scheduled.values()][0].delay, 5000);
  active = false; await timer.tick();
  assert.equal([...timer.scheduled.values()][0].delay, 30000);
  poll.stop(); assert.equal(timer.scheduled.size, 0);
});

test('coalesces focus events with an in-flight read and keeps only one timer', async () => {
  const timer = clock(); let calls = 0, complete;
  const poll = startVisiblePolling(() => { calls++; return new Promise(resolve => {complete = resolve;}); }, {...timer, isVisible: () => true});
  const first = poll.refresh();
  const second = poll.refresh(), third = poll.refresh();
  assert.equal(calls, 1);
  complete(false); await first;
  assert.equal(timer.scheduled.size, 1);
  poll.stop(); await Promise.all([second, third]);
});

test('does no hidden-page reads and refreshes immediately on return', async () => {
  const timer = clock(); let visible = false, calls = 0;
  const poll = startVisiblePolling(async () => {calls++; return false;}, {...timer, isVisible: () => visible});
  await poll.refresh(); await timer.tick();
  assert.equal(calls, 0);
  visible = true; await poll.refresh();
  assert.equal(calls, 1); assert.equal(timer.scheduled.size, 1);
  poll.stop();
});

test('unmount during a read cannot restart polling', async () => {
  const timer = clock(); let complete;
  const poll = startVisiblePolling(() => new Promise(resolve => {complete = resolve;}), {...timer, isVisible: () => true});
  const first = poll.refresh(); poll.stop(); complete(false); await first;
  await poll.refresh(); assert.equal(timer.scheduled.size, 0);
});

test('read errors keep a bounded retry cadence', async () => {
  const timer = clock(); const errors = [];
  const poll = startVisiblePolling(async () => {throw new Error('offline');}, {...timer, isVisible: () => true, onError: error => errors.push(error.message)});
  await poll.refresh();
  assert.deepEqual(errors, ['offline']); assert.equal(timer.scheduled.size, 1);
  poll.stop();
});

test('a refresh requested during a read is not lost behind the idle timer', async () => {
  const timer = clock(); let calls = 0, complete;
  const poll = startVisiblePolling(() => {
    calls++;
    return calls === 1 ? new Promise(resolve => {complete = resolve;}) : Promise.resolve(true);
  }, {...timer, isVisible: () => true});
  let refreshed = false;
  const first = poll.refresh();
  const second = poll.refresh().then(() => {refreshed = true;});
  complete(false); await first;
  assert.equal(refreshed, false);
  assert.equal([...timer.scheduled.values()][0].delay, 0);
  await timer.tick(); await second; assert.equal(calls, 2);
  assert.equal(refreshed, true);
  assert.equal([...timer.scheduled.values()][0].delay, 5000);
  poll.stop();
});

test('local job activation replaces the idle timer with an active cadence', async () => {
  const timer = clock();
  const poll = startVisiblePolling(async () => false, {...timer, isVisible: () => true});
  await poll.refresh();
  assert.equal([...timer.scheduled.values()][0].delay, 45000);
  poll.setActive(true);
  assert.equal([...timer.scheduled.values()][0].delay, 5000);
  poll.stop();
});

test('local activation survives an older idle response still in flight', async () => {
  const timer = clock(); let complete;
  const poll = startVisiblePolling(() => new Promise(resolve => {complete = resolve;}), {...timer, isVisible: () => true});
  const first = poll.refresh(); poll.setActive(true); complete(false); await first;
  assert.equal([...timer.scheduled.values()][0].delay, 5000);
  poll.stop();
});
