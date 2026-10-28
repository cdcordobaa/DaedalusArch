import type { InkwellClient } from 'inkwell-sdk';
import type { AllowanceSource } from '../../../application/ports/out/AllowanceSource';
import type { SigningAllowance } from '../../../domain/model/SigningAllowance';

/** Reads our Inkwell plan: envelopes left this billing cycle, and the cycle's end (the next day is the renewal). */
export class InkwellAllowanceAdapter implements AllowanceSource {
  constructor(private readonly client: InkwellClient) {}

  async current(): Promise<SigningAllowance> {
    const account = await this.client.account();
    const cycleEnd = new Date(account.billingCycleEndsAt);
    return {
      remaining: Math.max(0, account.envelopesRemaining),
      renewsOn: new Date(Date.UTC(cycleEnd.getUTCFullYear(), cycleEnd.getUTCMonth(), cycleEnd.getUTCDate() + 1)),
    };
  }
}
