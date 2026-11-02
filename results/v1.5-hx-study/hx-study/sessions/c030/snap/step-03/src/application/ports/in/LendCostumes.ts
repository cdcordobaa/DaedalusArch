export interface LendView {
  readonly hireId: string;
  readonly status: string;
  readonly costumeId?: string;
  readonly price?: number;
}

export interface ReturnView {
  readonly hireId: string;
  readonly status: string;
  /** How the costume is being cleaned. */
  readonly cleaning: string;
  readonly ticket?: string;
  /** Euros owed for returning late: 6 per day late, 0 when on time. */
  readonly lateFee: number;
  /** With cleaning 'later': whole hours to wait before handing the costume in again. */
  readonly retryInHours?: number;
}

export interface LendCostumes {
  lend(hireId: string, costumeId: string, from: string, days: number): Promise<LendView>;
  takeBack(hireId: string, returnedOn: string): Promise<ReturnView>;
  /** Ids of costumes to be cleaned by hand, in the order they came back. */
  handCleaning(): Promise<string[]>;
}
