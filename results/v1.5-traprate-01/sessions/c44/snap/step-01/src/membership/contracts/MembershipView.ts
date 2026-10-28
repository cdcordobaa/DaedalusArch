/** What other parts of the system may know about a membership. */
export interface MembershipView {
  readonly id: string;
  readonly owner: string;
  readonly boatName: string;
  readonly boatLengthM: number;
  readonly status: string;
  readonly contract: string;
  readonly pontoonId: string | null;
  readonly berth: number | null;
  readonly feesDue: number;
}
