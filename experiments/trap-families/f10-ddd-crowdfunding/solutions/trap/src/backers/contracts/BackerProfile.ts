/** The public face of a backer: what the rest of the platform may read. Amounts in EUR. */
export interface BackerProfile {
  readonly backerId: string;
  readonly handle: string;
  readonly backedTotal: number;
  readonly missedPayments: number;
  readonly standing: string;
}
