/** A trading date, written YYYY-MM-DD. Immutable; two dates compare as strings. */
export class MarketDate {
  private constructor(readonly iso: string) {}

  static parse(text: string): MarketDate {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) throw new Error(`bad date ${text}: write it as YYYY-MM-DD`);
    return new MarketDate(text);
  }

  isAfter(other: MarketDate): boolean {
    return this.iso > other.iso;
  }

  equals(other: MarketDate): boolean {
    return this.iso === other.iso;
  }
}
