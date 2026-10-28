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
}

export interface ManageAgreements {
  draft(request: DraftRequest): Promise<string>;
  send(id: string): Promise<void>;
  view(id: string): Promise<AgreementView>;
}
