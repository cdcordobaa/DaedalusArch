export class SchedulingError extends Error {
  constructor(readonly reason: 'unknown' | 'rejected' | 'clash', message: string) {
    super(message);
  }
}
