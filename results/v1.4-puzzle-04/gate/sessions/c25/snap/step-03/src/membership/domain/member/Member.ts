import type { MemberId } from './value-objects/MemberId';

export type Tier = 'gold' | 'silver' | 'standard';

/** Points from which a member holds each tier. */
const GOLD_FROM = 1500;
const SILVER_FROM = 500;

export interface MemberState {
  readonly id: MemberId;
  readonly name: string;
  readonly points: number;
  readonly rewardedOrders?: readonly string[];
}

/** A club member. Points never go below zero; the tier follows from the points. */
export class Member {
  private constructor(
    readonly id: MemberId,
    readonly name: string,
    private balance: number,
    private readonly rewardedOrders: Set<string> = new Set(),
  ) {}

  static enrol(id: MemberId, name: string): Member {
    if (name.trim() === '') throw new Error('a member needs a name');
    return new Member(id, name, 0);
  }

  static restore(state: MemberState): Member {
    return new Member(state.id, state.name, state.points, new Set(state.rewardedOrders));
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

  /** One point per whole currency unit paid; each order rewards at most once. */
  earnFromOrder(orderId: string, paidCents: number): void {
    if (this.rewardedOrders.has(orderId)) return;
    this.rewardedOrders.add(orderId);
    const points = Math.floor(paidCents / 100);
    if (points > 0) this.award(points);
  }

  state(): MemberState {
    return { id: this.id, name: this.name, points: this.balance, rewardedOrders: [...this.rewardedOrders] };
  }
}
