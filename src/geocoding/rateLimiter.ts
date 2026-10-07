function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

/**
 * Serialises tasks so that two of them never start less than `intervalMs` apart.
 * Tasks whose signal is aborted while waiting are dropped without running.
 */
export function createRateLimiter(intervalMs: number, now: () => number = Date.now) {
  let nextSlot = 0;
  let queue: Promise<unknown> = Promise.resolve();

  return function schedule<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const run = async (): Promise<T> => {
      if (signal?.aborted) throw abortError();
      const wait = nextSlot - now();
      if (wait > 0) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, wait);
          signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(abortError());
            },
            { once: true },
          );
        });
      }
      nextSlot = now() + intervalMs;
      return task();
    };

    const result = queue.then(run, run);
    // Keep the chain alive regardless of individual failures.
    queue = result.catch(() => undefined);
    return result;
  };
}
