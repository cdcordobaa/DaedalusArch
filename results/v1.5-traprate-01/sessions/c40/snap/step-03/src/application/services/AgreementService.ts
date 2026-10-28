import { TenancyError } from '../../domain/errors/TenancyError';
import { Agreement } from '../../domain/model/Agreement';
import { Party } from '../../domain/model/Party';
import type { AgreementView, DraftRequest, ManageAgreements } from '../ports/in/ManageAgreements';
import type { AgreementStore } from '../ports/out/AgreementStore';
import type { AllowanceSource } from '../ports/out/AllowanceSource';
import type { EnvelopeSender } from '../ports/out/EnvelopeSender';

export const toView = (a: Agreement): AgreementView => ({
  id: a.id,
  address: a.address,
  status: a.status,
  landlord: a.landlord.email,
  tenants: a.tenants.map((t) => t.email),
  monthlyRent: a.monthlyRent,
  startsOn: a.startsOn,
  ...(a.status === 'declined' && a.declinedBy !== undefined ? { declinedBy: a.declinedBy, reason: a.reason ?? '' } : {}),
  ...(a.sentAt !== undefined && a.status === 'out for signature' ? { sentAt: a.sentAt.toISOString() } : {}),
});

export class AgreementService implements ManageAgreements {
  private readonly sending = new Set<string>();

  constructor(
    private readonly store: AgreementStore,
    private readonly allowance: AllowanceSource,
    private readonly envelopes: EnvelopeSender,
  ) {}

  async draft(request: DraftRequest): Promise<string> {
    const landlord = Party.of(request.landlord.name, request.landlord.email);
    const tenants = request.tenants.map((t) => Party.of(t.name, t.email));
    const agreement = Agreement.draft(this.store.nextId(), request.address, landlord, tenants, request.monthlyRent, request.startsOn);
    await this.store.save(agreement);
    return agreement.id;
  }

  async view(id: string): Promise<AgreementView> {
    const agreement = await this.store.get(id);
    if (agreement === undefined) throw new TenancyError('No such agreement.');
    return toView(agreement);
  }

  async send(id: string): Promise<void> {
    const agreement = await this.store.get(id);
    if (agreement === undefined) throw new TenancyError('No such agreement.');
    if (this.sending.has(id)) throw new TenancyError('This agreement is already out for signature.');
    agreement.assertSendable();
    this.sending.add(id);
    try {
      if ((await this.allowance.current()).remaining <= 0) throw new TenancyError('No signatures left this month.');
      const sent = await this.envelopes.send(agreement);
      agreement.markSent(sent.envelopeId, sent.sentAt);
      await this.store.save(agreement);
    } finally {
      this.sending.delete(id);
    }
  }

  async sendReminders(now: Date): Promise<string[]> {
    const reminded: string[] = [];
    for (const agreement of await this.store.all()) {
      const envelopeId = agreement.envelopeId;
      if (envelopeId === undefined || !agreement.isDueForReminder(now)) continue;
      if ((await this.envelopes.remind(envelopeId)) !== 'reminded') continue;
      agreement.recordReminder(now);
      await this.store.save(agreement);
      reminded.push(agreement.id);
    }
    return reminded;
  }

  private async apply(envelopeId: string, change: (a: Agreement) => void): Promise<void> {
    const agreement = (await this.store.all()).find((a) => a.envelopeId === envelopeId);
    if (agreement === undefined) return;
    change(agreement);
    await this.store.save(agreement);
  }

  tenantDeclined(envelopeId: string, tenantEmail: string, reason: string): Promise<void> {
    return this.apply(envelopeId, (a) => {
      a.decline(tenantEmail, reason);
    });
  }

  signingExpired(envelopeId: string): Promise<void> {
    return this.apply(envelopeId, (a) => {
      a.expire();
    });
  }

  allSigned(envelopeId: string): Promise<void> {
    return this.apply(envelopeId, (a) => {
      a.complete();
    });
  }
}
