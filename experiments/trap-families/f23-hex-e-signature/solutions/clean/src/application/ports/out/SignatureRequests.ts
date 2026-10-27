import type { SignatureRequest } from '../../../domain/model/SignatureRequest';

export interface SentSigning {
  readonly ref: string;
  readonly sentAt: Date;
}

/** Sending agreements for signature. Fails with EmailRefused for an address it will not take, SignatureServiceBusy when busy. */
export interface SignatureRequests {
  send(request: SignatureRequest): Promise<SentSigning>;
  /** Emails of the signers who have not signed yet (copied people are not signers). */
  signersYetToSign(signingRef: string): Promise<string[]>;
  remind(signingRef: string, signerEmails: readonly string[]): Promise<void>;
}
