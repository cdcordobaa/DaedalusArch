import type { DebitoraClient } from 'debitora-sdk';
import type { FeeCollected, FeeCollection } from '../../../application/ports/out/FeeCollection';

export class DebitoraFeeCollectionAdapter implements FeeCollection {
  constructor(private readonly client: DebitoraClient) {}

  async collect(mandateId: string, feeEuros: number, description: string): Promise<FeeCollected> {
    const p = await this.client.createPayment({ mandate: mandateId, amount: Math.round(feeEuros * 100), currency: 'EUR', description });
    return { paymentId: p.id, accepted: p.status !== 'collection_failed' && p.status !== 'charged_back' };
  }
}
