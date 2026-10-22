import type { MemberId } from './value-objects/MemberId';

export type Tier = 'gold' | 'silver' | 'standard';

/** Points from which a member holds each tier. */
const GOLD_FROM = 1500;
const SILVER_FROM = 500;

export interface MemberState {
  readonly id: MemberId;
  readonly name: string;
  readonly points: number;
}

/** A club member. Points never go below zero; the tier follows from the points. */
export class Member {
  private constructor(
    readonly id: MemberId,
    readonly name: string,
    private balance: number,
  ) {}

  static enrol(id: MemberId, name: string): Member {
    if (name.trim() === '') throw new Error('a member needs a name');
    return new Member(id, name, 0);
  }

  static restore(state: MemberState): Member {
    return new Member(state.id, state.name, state.points);
  }

  get points(): number {
    return this.balance;
  }

  tier(): Tier {
    if (this.balance >= GOLD_FROM) return 'gold';
    if (this.balance >= SILVER_FROM) return 'silver';
    return 'standard';
  }

  award(points: number): void {
    if (!Number.isInteger(points) || points <= 0) throw new Error('awarded points must be a positive whole number');
    this.balance += points;
  }

  state(): MemberState {
    return { id: this.id, name: this.name, points: this.balance };
  }
}
