export interface PartyInput {
  readonly name: string;
  readonly email: string;
}

export interface DraftRequest {
  readonly address: string;
  readonly landlord: PartyInput;
  readonly tenants: readonly PartyInput[];
  readonly monthlyRent: number;
  readonly startsOn: string;
}

export interface AgreementView {
  readonly id: string;
  readonly address: string;
  readonly status: string;
  readonly landlord: string;
  readonly tenants: string[];
  readonly monthlyRent: number;
  readonly startsOn: string;
  /** UTC ISO time Inkwell sent the envelope; only while a signing has been started. */
  readonly sentAt?: string;
  /** Email of the tenant who declined; only when declined. */
  readonly declinedBy?: string;
  readonly reason?: string;
}

export type SigningEvent =
  | { readonly kind: 'declined'; readonly envelopeId: string; readonly email: string; readonly reason: string }
  | { readonly kind: 'expired'; readonly envelopeId: string }
  | { readonly kind: 'signed'; readonly envelopeId: string };

export interface ManageAgreements {
  draft(request: DraftRequest): Promise<string>;
  send(id: string): Promise<void>;
  view(id: string): Promise<AgreementView>;
  /** Reminds unsigned tenants of agreements out for signature; answers the ids reminded, in drafting order. */
  sendReminders(now: Date): Promise<string[]>;
  /** Records an outcome reported by the signing provider; events that no longer apply are ignored. */
  recordSigningEvent(event: SigningEvent): Promise<void>;
}
