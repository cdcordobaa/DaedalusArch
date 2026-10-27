export class CarId {
  private constructor(readonly value: string) {}

  static of(value: string): CarId {
    if (value.trim() === '') throw new Error('car id must not be empty');
    return new CarId(value);
  }

  equals(other: CarId): boolean {
    return other.value === this.value;
  }
}
