export interface HireRequest {
  readonly hireId: string;
  readonly boatId: string;
  /** The first day of the hire, YYYY-MM-DD. */
  readonly from: string;
  readonly nights: number;
  readonly hirerRef: string;
  readonly quoteRef: string;
}

export interface HireView {
  readonly hireId: string;
  readonly status: string;
  readonly boatId?: string;
  readonly price?: number;
  readonly reason?: string;
  readonly policyNo?: string;
  readonly missing?: readonly string[];
}

export interface HireBoats {
  reserve(request: HireRequest): Promise<HireView>;
  handOver(hireId: string): Promise<HireView>;
  bringBack(hireId: string): Promise<HireView>;
}
