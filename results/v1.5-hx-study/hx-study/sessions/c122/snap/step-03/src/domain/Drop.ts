import { LockerError } from './LockerError';
import type { LockerSize } from './LockerSize';

export type DropStatus = 'waiting' | 'collected' | 'returned';

/** A bag of finished laundry left in a locker for one apartment, released by its pickup code. */
export class Drop {
  private state: DropStatus = 'waiting';
  private ended: string | null = null;

  private constructor(
    readonly id: string,
    readonly buildingId: string,
    readonly lockerId: string,
    readonly apartment: string,
    readonly size: LockerSize,
    readonly code: string,
    readonly droppedAt: string,
  ) {}

  static leave(id: string, buildingId: string, lockerId: string, apartment: string, size: LockerSize, code: string, at: string): Drop {
    return new Drop(id, buildingId, lockerId, apartment, size, code, at);
  }

  get status(): DropStatus {
    return this.state;
  }

  get closedAt(): string | null {
    return this.ended;
  }

  get waiting(): boolean {
    return this.state === 'waiting';
  }

  /** Does this code release this drop now? */
  releasedBy(code: string): boolean {
    return this.state === 'waiting' && this.code === code;
  }

  collect(at: string): void {
    if (this.state !== 'waiting') throw new LockerError(`drop ${this.id} is no longer waiting`);
    this.state = 'collected';
    this.ended = at;
  }

  /** Has this drop waited at least `hours` hours at time `at` (YYYY-MM-DDTHH:MM, UTC)? */
  waitedAtLeast(hours: number, at: string): boolean {
    const ms = Date.parse(`${at}:00Z`) - Date.parse(`${this.droppedAt}:00Z`);
    return ms >= hours * 3600_000;
  }

  giveBack(at: string): void {
    if (this.state !== 'waiting') throw new LockerError(`drop ${this.id} is no longer waiting`);
    this.state = 'returned';
    this.ended = at;
  }
}
