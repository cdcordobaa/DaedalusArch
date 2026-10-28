import { TenancyError } from '../../domain/errors/TenancyError';
import { Agreement } from '../../domain/model/Agreement';
import { Party } from '../../domain/model/Party';
import type { AgreementView, DraftRequest, ManageAgreements, SigningEvent } from '../ports/in/ManageAgreements';
import type { AgreementStore } from '../ports/out/AgreementStore';
import type { AllowanceSource } from '../ports/out/AllowanceSource';
import type { EnvelopeSender } from '../ports/out/EnvelopeSender';

const LINK_VALID_DAYS = 14;

export const toView = (a: Agreement): AgreementView => ({
  id: a.id,
  address: a.address,
  status: a.status,
  landlord: a.landlord.email,
  tenants: a.tenants.map((t) => t.email),
  monthlyRent: a.monthlyRent,
  startsOn: a.startsOn,
  ...(a.sentAt === undefined ? {} : { sentAt: a.sentAt.toISOString() }),
  ...(a.declinedBy === undefined ? {} : { declinedBy: a.declinedBy }),
  ...(a.reason === undefined ? {} : { reason: a.reason }),
});

export class AgreementService implements ManageAgreements {
  private readonly sending = new Set<string>();

  constructor(
    private readonly store: AgreementStore,
    private readonly allowance: AllowanceSource,
    private readonly sender: EnvelopeSender,
  ) {}

  async draft(request: DraftRequest): Promise<string> {
    const landlord = Party.of(request.landlord.name, request.landlord.email);
    const tenants = request.tenants.map((t) => Party.of(t.name, t.email));
    const agreement = Agreement.draft(this.store.nextId(), request.address, landlord, tenants, request.monthlyRent, request.startsOn);
    await this.store.save(agreement);
    return agreement.id;
  }

  async send(id: string): Promise<void> {
    const agreement = await this.store.get(id);
    if (agreement === undefined) throw new TenancyError('No such agreement.');
    if (this.sending.has(id)) throw new TenancyError('This agreement is already out for signature.');
    agreement.assertSendable();
    this.sending.add(id);
    try {
      if ((await this.allowance.current()).remaining <= 0) throw new TenancyError('No signatures left this month.');
      const receipt = await this.sender.send({
        subject: `Tenancy agreement: ${agreement.address}`,
        documentText: agreement.text(),
        signers: agreement.tenants,
        copyTo: agreement.landlord,
        linkValidDays: LINK_VALID_DAYS,
      });
      agreement.markSent(receipt.sentAt, receipt.envelopeId);
      await this.store.save(agreement);
    } finally {
      this.sending.delete(id);
    }
  }

  async recordSigningEvent(event: SigningEvent): Promise<void> {
    const agreement = (await this.store.all()).find((a) => a.envelopeId === event.envelopeId);
    if (agreement === undefined) return;
    if (event.kind === 'declined') {
      if (!agreement.tenants.some((t) => t.email === event.email)) return;
      agreement.markDeclined(event.email, event.reason);
    } else if (event.kind === 'expired') {
      agreement.markExpired();
    } else {
      agreement.markSigned();
    }
    await this.store.save(agreement);
  }

  async view(id: string): Promise<AgreementView> {
    const agreement = await this.store.get(id);
    if (agreement === undefined) throw new TenancyError('No such agreement.');
    return toView(agreement);
  }
}
