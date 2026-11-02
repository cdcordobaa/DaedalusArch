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
  /** Late fee in euros; 0 when back on time. */
  readonly lateFee: number;
  readonly ticket?: string;
  /** Set when cleaning is postponed: whole hours to wait before trying again. */
  readonly retryInHours?: number;
}

export interface LendCostumes {
  lend(hireId: string, costumeId: string, from: string, days: number): Promise<LendView>;
  /** Costume ids waiting for hand cleaning, in the order they came back. */
  handCleaning(): Promise<string[]>;
  takeBack(hireId: string, returnedOn: string): Promise<ReturnView>;
}
