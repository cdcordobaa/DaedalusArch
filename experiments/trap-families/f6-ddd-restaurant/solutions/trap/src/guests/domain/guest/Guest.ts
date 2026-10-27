import type { GuestId } from './value-objects/GuestId';

export type Status = 'vip' | 'regular' | 'new';

/** Completed visits from which a guest holds each status. */
const VIP_FROM = 10;
const REGULAR_FROM = 4;

export interface GuestState {
  readonly id: GuestId;
  readonly name: string;
  readonly visits: number;
}

/** A guest of the restaurant group. Visits never go down; the status follows from the completed visits. */
export class Guest {
  private constructor(
    readonly id: GuestId,
    readonly name: string,
    private visitCount: number,
  ) {}

  static register(id: GuestId, name: string): Guest {
    if (name.trim() === '') throw new Error('a guest needs a name');
    return new Guest(id, name, 0);
  }

  static restore(state: GuestState): Guest {
    return new Guest(state.id, state.name, state.visits);
  }

  get visits(): number {
    return this.visitCount;
  }

  status(): Status {
    if (this.visitCount >= VIP_FROM) return 'vip';
    if (this.visitCount >= REGULAR_FROM) return 'regular';
    return 'new';
  }

  addVisits(visits: number): void {
    if (!Number.isInteger(visits) || visits <= 0) throw new Error('added visits must be a positive whole number');
    this.visitCount += visits;
  }

  state(): GuestState {
    return { id: this.id, name: this.name, visits: this.visitCount };
  }
}
