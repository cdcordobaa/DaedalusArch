import { InkwellError } from 'inkwell-sdk';
import type { InkwellClient, InkwellRecipient } from 'inkwell-sdk';
import type { EnvelopeSender, SentEnvelope } from '../../../application/ports/out/EnvelopeSender';
import { TenancyError } from '../../../domain/errors/TenancyError';
import type { Agreement } from '../../../domain/model/Agreement';

const EXPIRES_IN_DAYS = 14;

/** Sends an agreement through Inkwell: tenants sign in listed order, the landlord is copied after the last. */
export class InkwellEnvelopeAdapter implements EnvelopeSender {
  constructor(private readonly client: InkwellClient) {}

  async send(agreement: Agreement): Promise<SentEnvelope> {
    const signers: InkwellRecipient[] = agreement.tenants.map((t, i) => ({
      emailAddress: t.email,
      fullName: t.name,
      role: 'SIGNER',
      routingOrder: i + 1,
    }));
    const copy: InkwellRecipient = {
      emailAddress: agreement.landlord.email,
      fullName: agreement.landlord.name,
      role: 'CC',
      routingOrder: signers.length + 1,
    };
    try {
      const envelope = await this.client.createEnvelope({
        emailSubject: `Tenancy agreement: ${agreement.address}`,
        documents: [{ fileName: 'tenancy-agreement.txt', documentBase64: Buffer.from(agreement.text(), 'utf8').toString('base64') }],
        recipients: [...signers, copy],
        expiresInDays: EXPIRES_IN_DAYS,
      });
      return { envelopeId: envelope.envelopeId, sentAt: new Date(envelope.sentDateTime) };
    } catch (e) {
      if (e instanceof InkwellError && e.errorCode === 'INVALID_RECIPIENT' && e.recipientEmail !== undefined) {
        throw new TenancyError(`Inkwell could not accept the email ${e.recipientEmail}.`);
      }
      throw e;
    }
  }
}
