const DAY_MS = 24 * 60 * 60 * 1000;

/** Runs the job now and then once every 24 hours; errors are logged, never thrown. */
export function startDaily(job: () => Promise<void>, intervalMs = DAY_MS): void {
  const run = (): void => {
    job().catch((e) => console.error("Daily certification re-verification failed", e));
  };
  run();
  setInterval(run, intervalMs).unref();
}
