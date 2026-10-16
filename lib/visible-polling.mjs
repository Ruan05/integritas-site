/** One visible-page read at a time, with a slower cadence when work is idle. */
export function startVisiblePolling(read, {
  activeDelay = 5000,
  idleDelay = 45000,
  initiallyActive = false,
  isVisible = () => document.visibilityState === 'visible',
  schedule = setTimeout,
  cancel = clearTimeout,
  onError = /** @type {(error: unknown) => void} */ (() => {}),
} = {}) {
  let stopped = false, reading = false, requested = false, timer, active = initiallyActive;
  let activityVersion = 0;
  let waiters = [];
  const clear = () => { if (timer !== undefined) { cancel(timer); timer = undefined; } };
  const queue = () => {
    if (!stopped) timer = schedule(refresh, requested ? 0 : active ? activeDelay : idleDelay);
    requested = false;
  };
  async function refresh() {
    if (stopped) return;
    if (reading) {
      requested = true;
      return new Promise(resolve => { waiters.push(resolve); });
    }
    clear();
    const completing = waiters; waiters = [];
    if (!isVisible()) { completing.forEach(resolve => resolve()); queue(); return; }
    reading = true;
    const version = activityVersion;
    try {
      const next = Boolean(await read());
      if (version === activityVersion) active = next;
    }
    catch (error) { onError(error); }
    finally { reading = false; completing.forEach(resolve => resolve()); queue(); }
  }
  queue();
  return {
    refresh,
    setActive(value) {
      active = Boolean(value); activityVersion++;
      if (!reading) { clear(); queue(); }
    },
    stop() { stopped = true; clear(); waiters.forEach(resolve => resolve()); waiters = []; },
  };
}
