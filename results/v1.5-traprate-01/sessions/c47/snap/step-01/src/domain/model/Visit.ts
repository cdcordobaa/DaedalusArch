import { AccessRefused } from '../errors/LoungeErrors';
import type { Instant } from './Instant';

/** One stay of a pass holder (and their guests) in a lounge. */
export class Visit {
  private left: Instant | null = null;

  constructor(
    readonly id: string,
    readonly passId: string,
    readonly loungeId: string,
    private guestCount: number,
    readonly enteredAt: Instant,
  ) {}

  get guests(): number {
    return this.guestCount;
  }

  get leftAt(): Instant | null {
    return this.left;
  }

  get inProgress(): boolean {
    return this.left === null;
  }

  /** The holder plus their guests. */
  get people(): number {
    return 1 + this.guestCount;
  }

  leave(at: Instant): void {
    if (!this.inProgress) throw new AccessRefused(`visit ${this.id} has ended`);
    this.left = at;
  }
}
