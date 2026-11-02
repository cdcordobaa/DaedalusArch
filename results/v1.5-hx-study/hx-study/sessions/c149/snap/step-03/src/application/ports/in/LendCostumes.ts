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
  /** Late fee in euros (0 when on time). */
  readonly lateFee: number;
  /** With cleaning 'later': whole hours until the cleaners can be tried again. */
  readonly retryInHours?: number;
}

export interface LendCostumes {
  lend(hireId: string, costumeId: string, from: string, days: number): Promise<LendView>;
  takeBack(hireId: string, returnedOn: string): Promise<ReturnView>;
  /** Costume ids to be cleaned by hand, in the order they came back. */
  handCleaning(): Promise<string[]>;
}
