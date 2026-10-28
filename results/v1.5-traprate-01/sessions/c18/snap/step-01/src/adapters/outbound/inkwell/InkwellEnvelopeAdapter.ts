import { InkwellError } from 'inkwell-sdk';
import type { InkwellClient, InkwellRecipient } from 'inkwell-sdk';
import type { EnvelopeSender, SigningReceipt, SigningRequest } from '../../../application/ports/out/EnvelopeSender';
import { TenancyError } from '../../../domain/errors/TenancyError';

/** Sends an agreement as one Inkwell envelope. */
export class InkwellEnvelopeAdapter implements EnvelopeSender {
  constructor(private readonly client: InkwellClient) {}

  async send(request: SigningRequest): Promise<SigningReceipt> {
    const recipients: InkwellRecipient[] = request.signers.map((p, i) => ({
      emailAddress: p.email,
      fullName: p.name,
      role: 'SIGNER',
      routingOrder: i + 1,
    }));
    recipients.push({
      emailAddress: request.copyTo.email,
      fullName: request.copyTo.name,
      role: 'CC',
      routingOrder: request.signers.length + 1,
    });
    try {
      const envelope = await this.client.createEnvelope({
        emailSubject: request.subject,
        documents: [{ fileName: 'tenancy-agreement.txt', documentBase64: Buffer.from(request.documentText, 'utf8').toString('base64') }],
        recipients,
        expiresInDays: request.linkValidDays,
      });
      return { sentAt: new Date(envelope.sentDateTime) };
    } catch (e) {
      if (e instanceof InkwellError && e.errorCode === 'INVALID_RECIPIENT' && e.recipientEmail !== undefined) {
        throw new TenancyError(`Inkwell could not accept the email ${e.recipientEmail}.`);
      }
      throw e;
    }
  }
}
