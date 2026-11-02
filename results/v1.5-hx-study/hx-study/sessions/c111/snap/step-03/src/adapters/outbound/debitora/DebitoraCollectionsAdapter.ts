import type { DebitoraClient } from 'debitora-sdk';
import type { Collection, Collections } from '../../../application/ports/out/Collections';

export class DebitoraCollectionsAdapter implements Collections {
  constructor(private readonly client: DebitoraClient) {}

  async collect(mandateId: string, fee: number, description: string): Promise<Collection> {
    const p = await this.client.createPayment({ mandate: mandateId, amount: Math.round(fee * 100), currency: 'EUR', description });
    return { paymentId: p.id, taken: p.status !== 'collection_failed' };
  }
}
