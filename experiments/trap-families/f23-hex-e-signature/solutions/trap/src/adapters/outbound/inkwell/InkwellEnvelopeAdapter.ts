import type { InkwellClient, InkwellEnvelope, InkwellEnvelopeDraft, InkwellReminderReceipt, InkwellReminderRequest } from 'inkwell-sdk';
import type { InkwellPort } from '../../../application/ports/out/InkwellPort';

export class InkwellEnvelopeAdapter implements InkwellPort {
  constructor(private readonly client: InkwellClient) {}

  createEnvelope(draft: InkwellEnvelopeDraft): Promise<InkwellEnvelope> {
    return this.client.createEnvelope(draft);
  }

  getEnvelope(envelopeId: string): Promise<InkwellEnvelope> {
    return this.client.getEnvelope(envelopeId);
  }

  sendReminder(envelopeId: string, request: InkwellReminderRequest): Promise<InkwellReminderReceipt> {
    return this.client.sendReminder(envelopeId, request);
  }
}
