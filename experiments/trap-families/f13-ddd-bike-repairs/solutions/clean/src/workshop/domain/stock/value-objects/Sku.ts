/** A part number on the shop's shelves, for example CHAIN-11. */
export class Sku {
  private constructor(readonly value: string) {}

  static of(value: string): Sku {
    if (value.trim() === '') throw new Error('part number must not be empty');
    return new Sku(value.trim());
  }

  equals(other: Sku): boolean {
    return other.value === this.value;
  }
}
