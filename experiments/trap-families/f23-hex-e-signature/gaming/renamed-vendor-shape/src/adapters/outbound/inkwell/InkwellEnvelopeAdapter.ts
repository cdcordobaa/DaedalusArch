import type { InkwellClient } from 'inkwell-sdk';
import type { EnvelopeDraft, SentEnvelope, SignaturePort } from '../../../application/ports/out/SignaturePort';

export class InkwellEnvelopeAdapter implements SignaturePort {
  constructor(private readonly client: InkwellClient) {}

  createEnvelope(draft: EnvelopeDraft): Promise<SentEnvelope> {
    return this.client.createEnvelope({ ...draft, recipients: draft.recipients.map((r) => ({ ...r, role: r.role === 'CC' ? 'CC' : 'SIGNER' })) });
  }

  getEnvelope(envelopeId: string): Promise<SentEnvelope> {
    return this.client.getEnvelope(envelopeId);
  }

  sendReminder(envelopeId: string, request: { recipientEmails: string[] }): Promise<unknown> {
    return this.client.sendReminder(envelopeId, request);
  }
}
