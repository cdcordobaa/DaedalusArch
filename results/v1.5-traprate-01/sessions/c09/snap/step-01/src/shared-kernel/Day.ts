const MS_PER_DAY = 86_400_000;

/** A calendar day (YYYY-MM-DD, UTC). Immutable. */
export class Day {
  private constructor(private readonly epochDay: number) {}

  static parse(text: string): Day {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`not a day: ${text}`);
    const ms = Date.parse(`${text}T00:00:00Z`);
    if (Number.isNaN(ms)) throw new Error(`not a day: ${text}`);
    return new Day(Math.round(ms / MS_PER_DAY));
  }

  addDays(count: number): Day {
    return new Day(this.epochDay + count);
  }

  /** Whole days from `earlier` to this day (negative when `earlier` is later). */
  daysSince(earlier: Day): number {
    return this.epochDay - earlier.epochDay;
  }

  get text(): string {
    return new Date(this.epochDay * MS_PER_DAY).toISOString().slice(0, 10);
  }
}
