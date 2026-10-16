/**
 * Runs schedule-changing operations one at a time, so a slot-conflict check and the
 * save that follows it cannot interleave with another booking, cancel or reschedule.
 * One instance must be shared by every use case that changes the schedule.
 */
export class SchedulingLock {
  private queue: Promise<unknown> = Promise.resolve();

  run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => undefined);
    return result;
  }
}
