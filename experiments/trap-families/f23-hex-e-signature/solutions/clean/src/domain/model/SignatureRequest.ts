import type { Party } from './Party';

/** What a sending asks of the signature service: who signs, in which order, who is copied, for how long. */
export interface SignatureRequest {
  readonly subject: string;
  readonly document: string;
  /** In signing order. */
  readonly signers: readonly Party[];
  readonly copyTo: Party;
  readonly validForDays: number;
}
