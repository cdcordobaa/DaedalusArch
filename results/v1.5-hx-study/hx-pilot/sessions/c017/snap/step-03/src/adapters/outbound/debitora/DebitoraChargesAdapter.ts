import type { DebitoraClient } from 'debitora-sdk';
import type { ChargeOutcome } from '../../../application/ports/in/ChargeStatus';
import type { ChargeCreated, ChargeRequest, Charges } from '../../../application/ports/out/Charges';

export class DebitoraChargesAdapter implements Charges {
  constructor(private readonly client: DebitoraClient) {}

  async create(r: ChargeRequest): Promise<ChargeCreated> {
    const p = await this.client.createPayment({ mandate: r.mandateId, amount: r.amountCents, currency: 'EUR', description: r.description });
    return { paymentId: p.id, failed: p.status === 'collection_failed' };
  }

  async outcome(paymentId: string): Promise<ChargeOutcome> {
    const p = await this.client.getPayment(paymentId);
    if (p.status === 'confirmed' || p.status === 'paid_out') return 'collected';
    if (p.status === 'collection_failed' || p.status === 'charged_back') return 'bounced';
    return 'on_its_way';
  }
}
