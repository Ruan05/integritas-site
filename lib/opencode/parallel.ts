export async function runParallel<T, R>(
  tasks: T[],
  maxConcurrency: number,
  worker: (task: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(tasks.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < tasks.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(tasks[index], index);
    }
  }

  const workerCount = Math.min(Math.max(1, maxConcurrency), tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}
