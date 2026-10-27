export class ReservationId {
  private constructor(readonly value: string) {}

  static of(value: string): ReservationId {
    if (value.trim() === '') throw new Error('reservation id must not be empty');
    return new ReservationId(value);
  }
}
