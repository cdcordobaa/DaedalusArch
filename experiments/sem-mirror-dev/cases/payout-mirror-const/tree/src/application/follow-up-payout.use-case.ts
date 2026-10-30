import { PayoutState } from '../domain/payout';
import { PayoutsPort } from './ports/out/payouts.port';

export class FollowUpPayoutUseCase {
  constructor(private readonly payouts: PayoutsPort) {}

  /** Whether the market office must phone the stallholder about this payout. */
  async needsCall(id: string): Promise<boolean> {
    const p = await this.payouts.payout(id);
    return [PayoutState.Bounced, PayoutState.HeldCompliance].includes(p.state as never);
  }
}
