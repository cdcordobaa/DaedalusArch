import { TenancyError } from '../../domain/errors/TenancyError';
import { Agreement } from '../../domain/model/Agreement';
import { Party } from '../../domain/model/Party';
import type { AgreementView, DraftRequest, ManageAgreements } from '../ports/in/ManageAgreements';
import type { AgreementStore } from '../ports/out/AgreementStore';

export const toView = (a: Agreement): AgreementView => ({
  id: a.id,
  address: a.address,
  status: a.status,
  landlord: a.landlord.email,
  tenants: a.tenants.map((t) => t.email),
  monthlyRent: a.monthlyRent,
  startsOn: a.startsOn,
  ...(a.signing === undefined ? {} : { sentAt: a.signing.sentAt.toISOString() }),
  ...(a.declined === undefined ? {} : { declinedBy: a.declined.by, reason: a.declined.reason }),
});

export class AgreementService implements ManageAgreements {
  constructor(private readonly store: AgreementStore) {}

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
}
