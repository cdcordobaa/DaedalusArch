export class GuestId {
  private constructor(readonly value: string) {}

  static of(value: string): GuestId {
    if (value.trim() === '') throw new Error('guest id must not be empty');
    return new GuestId(value);
  }
}
