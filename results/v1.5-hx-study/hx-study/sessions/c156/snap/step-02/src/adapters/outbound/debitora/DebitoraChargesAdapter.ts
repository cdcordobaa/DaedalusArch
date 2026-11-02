import type { DebitoraClient, DebitoraPaymentStatus } from 'debitora-sdk';
import type { ChargeOutcome } from '../../../application/ports/in/ChargeStatus';
import type { Charges, Collection } from '../../../application/ports/out/Charges';

export class DebitoraChargesAdapter implements Charges {
  constructor(private readonly client: DebitoraClient) {}

  async collect(mandateId: string, euros: number, description: string): Promise<Collection> {
    const p = await this.client.createPayment({ mandate: mandateId, amount: Math.round(euros * 100), currency: 'EUR', description });
    return { paymentId: p.id, outcome: this.map(p.status) };
  }

  async outcome(paymentId: string): Promise<ChargeOutcome> {
    const p = await this.client.getPayment(paymentId);
    return this.map(p.status);
  }

  private map(status: DebitoraPaymentStatus): ChargeOutcome {
    if (status === 'confirmed' || status === 'paid_out') return 'collected';
    if (status === 'collection_failed' || status === 'charged_back') return 'bounced';
    return 'on_its_way';
  }
}
