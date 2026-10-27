import { TenancyError } from '../../domain/errors/TenancyError';
import type { AgreementStore } from '../ports/out/AgreementStore';
import type { AllowanceSource } from '../ports/out/AllowanceSource';
import type { SignaturePort } from '../ports/out/SignaturePort';

/** What the signing service tells us about a signing. */
interface SigningNotice { envelopeId: string }
interface DeclineNotice extends SigningNotice { recipient: { emailAddress: string; declineReason: string } }
interface SigningCallbacks {
  onRecipientDeclined(notice: DeclineNotice): Promise<void>;
  onEnvelopeExpired(notice: SigningNotice): Promise<void>;
  onEnvelopeCompleted(notice: SigningNotice): Promise<void>;
}
const failure = (e: unknown): { name?: string; errorCode?: string; recipientEmail?: string } => (e ?? {}) as { name?: string; errorCode?: string; recipientEmail?: string };

const DAY = 24 * 3600 * 1000;

export class SigningService implements SigningCallbacks {
  constructor(
    private readonly store: AgreementStore,
    private readonly allowance: AllowanceSource,
    private readonly inkwell: SignaturePort,
  ) {}

  async send(id: string): Promise<void> {
    const a = await this.store.get(id);
    if (a === undefined) throw new TenancyError('No such agreement.');
    if (a.status === 'out for signature') throw new TenancyError('This agreement is already out for signature.');
    if (a.status === 'signed') throw new TenancyError('This agreement is already signed.');
    if ((await this.allowance.current()).remaining <= 0) throw new TenancyError('No signatures left this month.');
    try {
      const env = await this.inkwell.createEnvelope({
        emailSubject: `Tenancy agreement: ${a.address}`,
        documents: [{ fileName: 'tenancy-agreement.txt', documentBase64: Buffer.from(a.text()).toString('base64') }],
        recipients: [...a.tenants.map((t, i) => ({ emailAddress: t.email, fullName: t.name, role: 'SIGNER', routingOrder: i + 1 })),
          { emailAddress: a.landlord.email, fullName: a.landlord.name, role: 'CC', routingOrder: a.tenants.length + 1 }],
        expiresInDays: 14,
      });
      a.envelope = { id: env.envelopeId, sentAt: new Date(env.sentDateTime), reminders: [] };
    } catch (e) {
      if (failure(e).name === 'InkwellError' && failure(e).errorCode === 'INVALID_RECIPIENT') throw new TenancyError(`Inkwell could not accept the email ${failure(e).recipientEmail ?? ''}.`);
      throw e;
    }
    a.declinedBy = undefined;
    a.reason = undefined;
    a.setStatus('out for signature');
    await this.store.save(a);
  }

  private async awaiting(envelopeId: string) {
    const a = (await this.store.all()).find((x) => x.envelope?.id === envelopeId);
    return a?.status === 'out for signature' ? a : undefined;
  }

  async onRecipientDeclined(event: DeclineNotice): Promise<void> {
    const a = await this.awaiting(event.envelopeId);
    if (a === undefined) return;
    a.declinedBy = event.recipient.emailAddress.toLowerCase();
    a.reason = event.recipient.declineReason;
    a.setStatus('declined');
  }

  async onEnvelopeExpired(event: SigningNotice): Promise<void> {
    (await this.awaiting(event.envelopeId))?.setStatus('expired');
  }

  async onEnvelopeCompleted(event: SigningNotice): Promise<void> {
    (await this.awaiting(event.envelopeId))?.setStatus('signed');
  }

  async sendReminders(now: Date): Promise<string[]> {
    const done: string[] = [];
    for (const a of await this.store.all()) {
      const env = a.envelope;
      if (a.status !== 'out for signature' || env === undefined || env.reminders.length >= 2) continue;
      if (now.getTime() >= env.sentAt.getTime() + 14 * DAY) continue;
      if (now.getTime() - (env.reminders.at(-1) ?? env.sentAt).getTime() < 3 * DAY) continue;
      const pending = (await this.inkwell.getEnvelope(env.id)).recipients.filter((r) => r.role === 'SIGNER' && r.recipientStatus !== 'SIGNED');
      if (pending.length === 0) continue;
      try {
        await this.inkwell.sendReminder(env.id, { recipientEmails: pending.map((r) => r.emailAddress) });
      } catch (e) {
        if (failure(e).name === 'InkwellError' && failure(e).errorCode === 'RATE_LIMITED') continue;
        throw e;
      }
      env.reminders.push(now);
      done.push(a.id);
    }
    return done;
  }
}
