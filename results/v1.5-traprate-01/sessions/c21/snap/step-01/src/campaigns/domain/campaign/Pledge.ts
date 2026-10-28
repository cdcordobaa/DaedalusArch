import type { Amount } from '../../../shared-kernel/Amount';

export type PledgeStatus = 'active' | 'collected' | 'released';

/** One promise of money to a campaign. Collected when the campaign is funded, released when it fails. */
export class Pledge {
  constructor(
    readonly pledgeId: string,
    readonly backerId: string,
    readonly amount: Amount,
    private state: PledgeStatus = 'active',
  ) {}

  get status(): PledgeStatus {
    return this.state;
  }

  collect(): void {
    if (this.state !== 'active') throw new Error(`pledge ${this.pledgeId} is already ${this.state}`);
    this.state = 'collected';
  }

  release(): void {
    if (this.state !== 'active') throw new Error(`pledge ${this.pledgeId} is already ${this.state}`);
    this.state = 'released';
  }
}
