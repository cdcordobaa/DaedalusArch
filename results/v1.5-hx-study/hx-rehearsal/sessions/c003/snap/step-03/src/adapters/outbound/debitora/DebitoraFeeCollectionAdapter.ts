import type { DebitoraClient } from 'debitora-sdk';
import type { FeeCollection, FeeCollectionResult } from '../../../application/ports/out/FeeCollection';

export class DebitoraFeeCollectionAdapter implements FeeCollection {
  constructor(private readonly client: DebitoraClient) {}

  async collect(mandateId: string, amountEuros: number, description: string): Promise<FeeCollectionResult> {
    const p = await this.client.createPayment({ mandate: mandateId, amount: Math.round(amountEuros * 100), currency: 'EUR', description });
    return { paymentId: p.id, accepted: p.status !== 'collection_failed' };
  }
}
