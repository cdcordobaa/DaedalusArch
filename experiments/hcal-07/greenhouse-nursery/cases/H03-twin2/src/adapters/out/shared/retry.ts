export async function withRetry<T>(attempts: number, run: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await run();
    } catch (e) {
      last = e;
    }
  }
  throw last;
}
