import { InkwellError, type InkwellClient, type InkwellRecipient } from 'inkwell-sdk';
import type { SentSigning, SignatureRequests } from '../../../application/ports/out/SignatureRequests';
import { EmailRefused } from '../../../domain/errors/EmailRefused';
import { SignatureServiceBusy } from '../../../domain/errors/SignatureServiceBusy';
import type { SignatureRequest } from '../../../domain/model/SignatureRequest';

/** Signing through Inkwell envelopes: one envelope per sending, tenants as signers, the landlord as a copy. */
export class InkwellSignatureAdapter implements SignatureRequests {
  constructor(private readonly client: InkwellClient) {}

  async send(request: SignatureRequest): Promise<SentSigning> {
    const signers: InkwellRecipient[] = request.signers.map((p, i) => ({ emailAddress: p.email, fullName: p.name, role: 'SIGNER', routingOrder: i + 1 }));
    const copy: InkwellRecipient = { emailAddress: request.copyTo.email, fullName: request.copyTo.name, role: 'CC', routingOrder: signers.length + 1 };
    const envelope = await this.call(() => this.client.createEnvelope({
      emailSubject: request.subject,
      documents: [{ fileName: 'tenancy-agreement.txt', documentBase64: Buffer.from(request.document, 'utf8').toString('base64') }],
      recipients: [...signers, copy],
      expiresInDays: request.validForDays,
    }));
    return { ref: envelope.envelopeId, sentAt: new Date(envelope.sentDateTime) };
  }

  async signersYetToSign(signingRef: string): Promise<string[]> {
    const envelope = await this.call(() => this.client.getEnvelope(signingRef));
    return envelope.recipients.filter((r) => r.role === 'SIGNER' && r.recipientStatus !== 'SIGNED').map((r) => r.emailAddress);
  }

  async remind(signingRef: string, signerEmails: readonly string[]): Promise<void> {
    await this.call(() => this.client.sendReminder(signingRef, { recipientEmails: [...signerEmails] }));
  }

  private async call<T>(op: () => Promise<T>): Promise<T> {
    try {
      return await op();
    } catch (e) {
      if (e instanceof InkwellError && e.errorCode === 'INVALID_RECIPIENT') throw new EmailRefused(e.recipientEmail ?? 'unknown');
      if (e instanceof InkwellError && e.errorCode === 'RATE_LIMITED') throw new SignatureServiceBusy();
      throw e;
    }
  }
}
