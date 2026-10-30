import type { ChargeStatus, ChargeView } from '../ports/in/ChargeStatus';
import type { Charges } from '../ports/out/Charges';

export class ChargeStatusService implements ChargeStatus {
  constructor(private readonly charges: Charges) {}

  async status(paymentId: string): Promise<ChargeView> {
    return { paymentId, outcome: await this.charges.outcome(paymentId) };
  }
}
