export class LotNumber {
  private constructor(readonly text: string) {}

  static of(text: string): LotNumber {
    if (text.trim() === '') throw new Error('a lot number must not be empty');
    return new LotNumber(text.trim());
  }

  sameAs(other: LotNumber): boolean {
    return this.text === other.text;
  }
}
