export class ShiftId {
  private constructor(readonly value: string) {}

  static of(value: string): ShiftId {
    if (value.trim() === '') throw new Error('shift id must not be empty');
    return new ShiftId(value);
  }
}
