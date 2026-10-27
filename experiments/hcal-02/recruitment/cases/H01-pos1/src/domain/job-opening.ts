import { OpeningClosedError } from "./errors";
import { OpeningRepository } from "../application/ports/out/opening-repository";

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

  static async reload(repo: OpeningRepository, id: string): Promise<JobOpening | null> {
    return repo.findById(id);
  }
}
