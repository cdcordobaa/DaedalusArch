import type { DebitoraClient } from 'debitora-sdk';
import type { MandateRecord } from '../../../domain/model/MandateRecord';
import type { Mandates } from '../../../application/ports/out/Mandates';

export class DebitoraMandatesAdapter implements Mandates {
  constructor(private readonly client: DebitoraClient) {}

  async find(mandateId: string): Promise<MandateRecord> {
    const m = await this.client.getMandate(mandateId);
    return { mandateId: m.id, reference: m.reference, providerStatus: m.status, active: m.status === 'mandate_active' };
  }
}
