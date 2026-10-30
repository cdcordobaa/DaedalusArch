import type { DebitoraClient, DebitoraPaymentStatus } from 'debitora-sdk';
import type { ChargeOutcome } from '../../../application/ports/in/ChargeStatus';
import type { Charges, Collection } from '../../../application/ports/out/Charges';

export class DebitoraChargesAdapter implements Charges {
  constructor(private readonly client: DebitoraClient) {}

  async outcome(paymentId: string): Promise<ChargeOutcome> {
    return outcomeOf((await this.client.getPayment(paymentId)).status);
  }

  async collect(mandateId: string, amount: number): Promise<Collection> {
    const p = await this.client.createPayment({ mandate: mandateId, amount: Math.round(amount * 100), currency: 'EUR', description: 'Chimney sweep' });
    return { paymentId: p.id, outcome: outcomeOf(p.status) };
  }
}

function outcomeOf(status: DebitoraPaymentStatus): ChargeOutcome {
  if (status === 'confirmed' || status === 'paid_out') return 'collected';
  if (status === 'failed' || status === 'charged_back') return 'bounced';
  return 'on_its_way';
}
