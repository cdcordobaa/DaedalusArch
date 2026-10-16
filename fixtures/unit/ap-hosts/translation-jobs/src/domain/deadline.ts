const DAY_MS = 24 * 60 * 60 * 1000;

/** Turnaround the agency commits to: about 2 500 words per working day, rush below three days. */
export class Deadline {
  static readonly WORDS_PER_DAY = 2500;
  static readonly RUSH_DAYS = 3;

  readonly dueAt: Date;

  constructor(dueAt: Date) {
    this.dueAt = dueAt;
  }

  daysFrom(now: Date): number {
    return (this.dueAt.getTime() - now.getTime()) / DAY_MS;
  }

  isRush(now: Date): boolean {
    return this.daysFrom(now) < Deadline.RUSH_DAYS;
  }

  isFeasible(words: number, now: Date): boolean {
    return this.daysFrom(now) * Deadline.WORDS_PER_DAY >= words;
  }
}
