import type { AgreementView } from './ManageAgreements';

export interface SendForSignature {
  send(agreementId: string): Promise<AgreementView>;
}
