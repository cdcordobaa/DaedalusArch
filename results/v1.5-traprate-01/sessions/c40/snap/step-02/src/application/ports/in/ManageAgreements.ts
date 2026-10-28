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
  /** UTC ISO time Inkwell sent the envelope; present while a signing is under way. */
  readonly sentAt?: string;
  /** Email of the tenant who declined; present when the status is 'declined'. */
  readonly declinedBy?: string;
  /** The reason that tenant gave. */
  readonly reason?: string;
}

export interface ManageAgreements {
  draft(request: DraftRequest): Promise<string>;
  view(id: string): Promise<AgreementView>;
  send(id: string): Promise<void>;
  /** Outcomes Inkwell reports for the signing identified by envelopeId; unknown or superseded signings are ignored. */
  tenantDeclined(envelopeId: string, tenantEmail: string, reason: string): Promise<void>;
  signingExpired(envelopeId: string): Promise<void>;
  allSigned(envelopeId: string): Promise<void>;
}
