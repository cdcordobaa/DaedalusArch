export class CarParkId {
  private constructor(readonly value: string) {}

  static of(value: string): CarParkId {
    if (value.trim() === '') throw new Error('car park id must not be empty');
    return new CarParkId(value);
  }
}
