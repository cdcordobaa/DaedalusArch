import { Amount } from '../../../shared-kernel/Amount';
import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { CampaignClosed } from './events/CampaignClosed';
import { PledgeMade } from './events/PledgeMade';
import { Pledge, type PledgeStatus } from './Pledge';
import type { CampaignId } from './value-objects/CampaignId';
import type { PledgeCap } from './value-objects/PledgeCap';

export type CampaignStatus = 'open' | 'funded' | 'failed';

export interface CampaignSnapshot {
  readonly id: CampaignId;
  readonly title: string;
  readonly goalCents: number;
  readonly status: CampaignStatus;
  readonly pledges: readonly { pledgeId: string; backerId: string; amountCents: number; status: PledgeStatus }[];
}

/**
 * An all-or-nothing campaign. Pledges are taken only while it is open; closing it collects every pledge when the
 * goal is reached and releases every pledge otherwise. A closed campaign never changes again.
 */
export class Campaign {
  private outbox: DomainEvent[] = [];

  private constructor(
    readonly id: CampaignId,
    readonly title: string,
    readonly goal: Amount,
    private status: CampaignStatus,
    private readonly pledges: Pledge[],
  ) {}

  static launch(id: CampaignId, title: string, goal: Amount): Campaign {
    if (title.trim() === '') throw new Error('a campaign needs a title');
    if (!goal.isPositive()) throw new Error('the goal must be a positive amount');
    return new Campaign(id, title.trim(), goal, 'open', []);
  }

  static fromSnapshot(s: CampaignSnapshot): Campaign {
    const pledges = s.pledges.map((p) => new Pledge(p.pledgeId, p.backerId, Amount.ofCents(p.amountCents), p.status));
    return new Campaign(s.id, s.title, Amount.ofCents(s.goalCents), s.status, pledges);
  }

  get currentStatus(): CampaignStatus {
    return this.status;
  }

  /** Money promised and not released. */
  raised(): Amount {
    return this.pledges.filter((p) => p.status !== 'released').reduce((sum, p) => sum.add(p.amount), Amount.ZERO);
  }

  pledgedBy(backerId: string): Amount {
    return this.pledges.filter((p) => p.backerId === backerId && p.status !== 'released').reduce((sum, p) => sum.add(p.amount), Amount.ZERO);
  }

  collectedPledges(): readonly Pledge[] {
    return this.pledges.filter((p) => p.status === 'collected');
  }

  /** Room the backer has left on this campaign under the cap. */
  roomLeftFor(backerId: string, cap: PledgeCap): Amount {
    return cap.limit.subtract(this.pledgedBy(backerId));
  }

  takePledge(backerId: string, amount: Amount, cap: PledgeCap): Pledge {
    if (this.status !== 'open') throw new Error(`campaign ${this.id.value} is closed`);
    if (!amount.isPositive()) throw new Error('a pledge must be a positive amount');
    if (cap.blocked) throw new Error(`backer ${backerId} is blocked from pledging`);
    if (amount.exceeds(this.roomLeftFor(backerId, cap))) {
      throw new Error(`a pledge of ${amount.label()} is over the limit: ${backerId} has ${this.roomLeftFor(backerId, cap).label()} left on ${this.id.value}`);
    }
    const pledge = new Pledge(`${this.id.value}/${String(this.pledges.length + 1)}`, backerId, amount);
    this.pledges.push(pledge);
    this.outbox.push(new PledgeMade(this.id.value, pledge.pledgeId, backerId, amount.cents));
    return pledge;
  }

  close(): CampaignStatus {
    if (this.status !== 'open') throw new Error(`campaign ${this.id.value} is closed`);
    const funded = this.raised().reaches(this.goal);
    for (const p of this.pledges) {
      if (funded) p.collect();
      else p.release();
    }
    this.status = funded ? 'funded' : 'failed';
    const collected = this.collectedPledges().map((p) => ({ pledgeId: p.pledgeId, backerId: p.backerId, amountCents: p.amount.cents }));
    this.outbox.push(new CampaignClosed(this.id.value, this.title, this.status === 'funded' ? 'funded' : 'failed', this.raised().cents, collected));
    return this.status;
  }

  snapshot(): CampaignSnapshot {
    return {
      id: this.id,
      title: this.title,
      goalCents: this.goal.cents,
      status: this.status,
      pledges: this.pledges.map((p) => ({ pledgeId: p.pledgeId, backerId: p.backerId, amountCents: p.amount.cents, status: p.status })),
    };
  }

  /** Hands over the facts raised since the last save; the store keeps them with the campaign. */
  releaseEvents(): DomainEvent[] {
    const out = this.outbox;
    this.outbox = [];
    return out;
  }
}
