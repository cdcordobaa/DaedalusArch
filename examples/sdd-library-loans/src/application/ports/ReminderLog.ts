/** Outbound port: when each loan was last reminded. */
export interface ReminderLog {
  lastSent(loanId: string): Promise<Date | undefined>;
  record(loanId: string, at: Date): Promise<void>;
}
