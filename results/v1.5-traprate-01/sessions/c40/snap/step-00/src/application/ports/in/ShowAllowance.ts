export interface AllowanceView {
  readonly remaining: number;
  /** YYYY-MM-DD, UTC. */
  readonly renewsOn: string;
}

export interface ShowAllowance {
  allowance(): Promise<AllowanceView>;
}
