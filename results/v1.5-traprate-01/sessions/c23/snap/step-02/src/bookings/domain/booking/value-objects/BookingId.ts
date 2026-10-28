export class BookingId {
  private constructor(readonly value: string) {}

  static of(value: string): BookingId {
    if (value.trim() === '') throw new Error('booking id must not be empty');
    return new BookingId(value);
  }
}
