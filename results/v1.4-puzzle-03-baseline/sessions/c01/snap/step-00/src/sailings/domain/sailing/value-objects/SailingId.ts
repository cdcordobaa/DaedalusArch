export class SailingId {
  private constructor(readonly value: string) {}

  static of(value: string): SailingId {
    if (value.trim() === '') throw new Error('sailing id must not be empty');
    return new SailingId(value);
  }
}
