/** Runs a job every day at the given local hour. */
export function scheduleDaily(hour: number, job: () => Promise<unknown> | unknown): void {
  const scheduleNext = (): void => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    setTimeout(() => {
      Promise.resolve()
        .then(job)
        .catch((e) => console.error('scheduled job failed', e))
        .finally(scheduleNext);
    }, next.getTime() - now.getTime());
  };
  scheduleNext();
}
