export class SectionId {
  private constructor(readonly value: string) {}

  static of(value: string): SectionId {
    if (value.trim() === '') throw new Error('section id must not be empty');
    return new SectionId(value);
  }

  equals(other: SectionId): boolean {
    return other.value === this.value;
  }
}
