import { OpeningClosedError } from "./errors";

export class JobOpening {
  private open = true;

  constructor(
    readonly id: string,
    readonly title: string,
    readonly deadline: Date,
    readonly minYears: number,
  ) {}

  isOpenAt(now: Date): boolean {
    return this.open && now.getTime() <= this.deadline.getTime();
  }

  assertOpenAt(now: Date): void {
    if (!this.isOpenAt(now)) {
      throw new OpeningClosedError(this.id);
    }
  }

  close(): void { this.open = false; }

  static fromRecord(r: { id: string; title: string; deadline: string; minYears: number }): JobOpening {
    return new JobOpening(r.id, r.title, new Date(r.deadline), r.minYears);
  }
}
