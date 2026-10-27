import { TenancyError } from '../../domain/errors/TenancyError';
import type { AgreementView } from '../ports/in/ManageAgreements';
import type { SendForSignature } from '../ports/in/SendForSignature';
import type { AgreementStore } from '../ports/out/AgreementStore';
import type { AllowanceSource } from '../ports/out/AllowanceSource';
import type { SignatureRequests } from '../ports/out/SignatureRequests';
import { toView } from './AgreementService';

export class SendForSignatureService implements SendForSignature {
  constructor(
    private readonly store: AgreementStore,
    private readonly allowance: AllowanceSource,
    private readonly signatures: SignatureRequests,
  ) {}

  async send(agreementId: string): Promise<AgreementView> {
    const agreement = await this.store.get(agreementId);
    if (agreement === undefined) throw new TenancyError('No such agreement.');
    agreement.ensureSendable();
    if ((await this.allowance.current()).remaining <= 0) throw new TenancyError('No signatures left this month.');
    const sent = await this.signatures.send(agreement.signatureRequest());
    agreement.markSent(sent.ref, sent.sentAt);
    await this.store.save(agreement);
    return toView(agreement);
  }
}
