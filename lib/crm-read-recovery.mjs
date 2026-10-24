const RETRYABLE_STATUS = new Set([502, 503, 504]);

function retryable(error) {
  return error instanceof TypeError || RETRYABLE_STATUS.has(Number(error?.status));
}

/** Retry idempotent CRM reads after network/gateway failures only. */
export async function readWithRetry(read, { attempts = 2, delayMs = 500, sleep } = {}) {
  const wait = sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  for (let retry = 0; ; retry++) {
    try {
      return await read();
    } catch (error) {
      if (!retryable(error) || retry >= attempts) throw error;
      await wait(delayMs * (retry + 1));
    }
  }
}

/** Clear a stale fetch notice only after the read that raised it has recovered. */
export function clearRecoveredReadError(message, source) {
  return source === 'read' ? '' : message;
}
