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
  /** Late fee in euros; 0 when the costume is back on time. */
  readonly lateFee: number;
  /** Set when cleaning is postponed: whole hours until the cleaners can be tried again. */
  readonly retryInHours?: number;
}

export interface LendCostumes {
  lend(hireId: string, costumeId: string, from: string, days: number): Promise<LendView>;
  takeBack(hireId: string, returnedOn: string): Promise<ReturnView>;
  /** Costume ids awaiting hand cleaning, in the order they came back. */
  handCleaning(): Promise<string[]>;
}
