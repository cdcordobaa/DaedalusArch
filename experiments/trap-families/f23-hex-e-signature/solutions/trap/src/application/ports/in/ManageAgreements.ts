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
  readonly sentAt?: string;
  readonly declinedBy?: string;
  readonly reason?: string;
}

export interface AgreementView {
  readonly id: string;
  readonly address: string;
  readonly status: string;
  readonly landlord: string;
  readonly tenants: string[];
  readonly monthlyRent: number;
  readonly startsOn: string;
  readonly sentAt?: string;
  readonly declinedBy?: string;
  readonly reason?: string;
}

export interface ManageAgreements {
  draft(request: DraftRequest): Promise<string>;
  view(id: string): Promise<AgreementView>;
}
