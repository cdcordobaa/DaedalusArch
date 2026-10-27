const cancelWindowMs = 2 * 3_600_000;

export class Appointment {
  private state: 'booked' | 'cancelled' = 'booked';
  constructor(
    readonly id: string,
    readonly doctorId: string,
    readonly patientId: string,
    readonly start: number,
    readonly end: number,
  ) {}
  isCancelled(): boolean {
    return this.state === 'cancelled';
  }
  cancel(now: number): void {
    if (this.start - now < cancelWindowMs) {
      throw new Error('too late to cancel');
    }
    this.state = 'cancelled';
  }
}
