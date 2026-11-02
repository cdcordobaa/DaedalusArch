import type { DebitoraClient } from 'debitora-sdk';
import type { ChargeOutcome } from '../../../application/ports/in/ChargeStatus';
import type { Charges, NewCharge } from '../../../application/ports/out/Charges';

export class DebitoraChargesAdapter implements Charges {
  constructor(private readonly client: DebitoraClient) {}

  async create(mandateId: string, amountEuros: number, description: string): Promise<NewCharge> {
    const p = await this.client.createPayment({ mandate: mandateId, amount: Math.round(amountEuros * 100), currency: 'EUR', description });
    return { paymentId: p.id, collectionFailed: p.status === 'collection_failed' };
  }

  async outcome(paymentId: string): Promise<ChargeOutcome> {
    const p = await this.client.getPayment(paymentId);
    if (p.status === 'confirmed' || p.status === 'paid_out') return 'collected';
    if (p.status === 'collection_failed' || p.status === 'charged_back') return 'bounced';
    return 'on_its_way';
  }
}
