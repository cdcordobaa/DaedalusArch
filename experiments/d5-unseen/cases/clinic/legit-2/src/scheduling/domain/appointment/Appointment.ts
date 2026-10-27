const minNoticeMs = 24 * 60 * 60 * 1000;
const cancelWindowMs = minNoticeMs;

export class Appointment {
  private cancelledAt: number | null = null;
  constructor(readonly id: string, readonly start: number, readonly end: number) {}
  cancel(now: number): void {
    if (this.start - now < cancelWindowMs) {
      throw new Error('inside the notice period');
    }
    this.cancelledAt = now;
  }
  wasCancelled(): boolean {
    return this.cancelledAt !== null;
  }
}
