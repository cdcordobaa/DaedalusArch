import { Amount } from '../../../shared-kernel/Amount';
import type { BackerId } from './value-objects/BackerId';

/** How far the platform trusts a backer. */
export type Standing = 'trusted' | 'established' | 'newcomer' | 'blocked';

/** Backed totals (in cents) from which a backer holds each standing, and the missed payments that block one. */
const TRUSTED_FROM_CENTS = 200_000;
const ESTABLISHED_FROM_CENTS = 50_000;
const BLOCKED_AFTER_MISSED = 2;

export interface BackerSnapshot {
  readonly id: BackerId;
  readonly handle: string;
  readonly backedCents: number;
  readonly missedPayments: number;
  /** Collected pledges already on the record, so that a repeated notice adds nothing. */
  readonly creditedPledges: readonly string[];
}

/**
 * Someone who pledges on campaigns. The backed total only grows; two missed payments block a backer whatever the
 * total. The standing follows from the record and from nothing else.
 */
export class Backer {
  private constructor(
    readonly id: BackerId,
    readonly handle: string,
    private backedCents: number,
    private missed: number,
    private readonly credited: Set<string>,
  ) {}

  static register(id: BackerId, handle: string): Backer {
    if (handle.trim() === '') throw new Error('a backer needs a handle');
    return new Backer(id, handle.trim(), 0, 0, new Set());
  }

  static fromSnapshot(s: BackerSnapshot): Backer {
    return new Backer(s.id, s.handle, s.backedCents, s.missedPayments, new Set(s.creditedPledges));
  }

  get backedTotal(): Amount {
    return Amount.ofCents(this.backedCents);
  }

  get missedPayments(): number {
    return this.missed;
  }

  standing(): Standing {
    if (this.missed >= BLOCKED_AFTER_MISSED) return 'blocked';
    if (this.backedCents >= TRUSTED_FROM_CENTS) return 'trusted';
    if (this.backedCents >= ESTABLISHED_FROM_CENTS) return 'established';
    return 'newcomer';
  }

  /** History brought over from the platform the backer used before. */
  addPastBackings(amount: Amount): void {
    if (!amount.isPositive()) throw new Error('past backings must be a positive amount');
    this.backedCents += amount.cents;
  }

  /** A pledge of this backer was collected by a funded campaign. Counted once per pledge. */
  creditCollectedPledge(pledgeId: string, amount: Amount): void {
    if (!amount.isPositive()) throw new Error('a collected pledge must be a positive amount');
    if (this.credited.has(pledgeId)) return;
    this.credited.add(pledgeId);
    this.backedCents += amount.cents;
  }

  missPayment(): void {
    this.missed += 1;
  }

  snapshot(): BackerSnapshot {
    return { id: this.id, handle: this.handle, backedCents: this.backedCents, missedPayments: this.missed, creditedPledges: [...this.credited] };
  }
}
