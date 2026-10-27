import { InvalidReadingError, ReadingOutOfOrderError } from "./errors";
import { Reading } from "./reading";

export class Meter {
  private readonly history: Reading[] = [];

  constructor(readonly id: string, readonly tariffId: string) {}

  record(reading: Reading, reference: number | null = null): void {
    if (reference !== null && reading.kwh.value < reference) {
      throw new InvalidReadingError("reading is below the grid operator reference");
    }
    const last = this.latest();
    if (last && !reading.kwh.isAtLeast(last.kwh)) {
      throw new ReadingOutOfOrderError("reading is lower than the previous one");
    }
    this.history.push(reading);
  }

  latest(): Reading | undefined {
    return this.history[this.history.length - 1];
  }

  first(): Reading | undefined {
    return this.history[0];
  }

  readings(): readonly Reading[] {
    return this.history;
  }
}
