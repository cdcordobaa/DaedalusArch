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
  /** Hours to wait before handing the costume in again. */
  readonly retryInHours?: number;
  /** 6 euros for each day after the hire ended; 0 when back on time. */
  readonly lateFee?: number;
}

export interface LendCostumes {
  lend(hireId: string, costumeId: string, from: string, days: number): Promise<LendView>;
  takeBack(hireId: string, returnedOn: string): Promise<ReturnView>;
  handCleaning(): Promise<string[]>;
}
