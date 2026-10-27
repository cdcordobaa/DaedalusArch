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
    void now;
    this.state = 'cancelled';
  }
}
