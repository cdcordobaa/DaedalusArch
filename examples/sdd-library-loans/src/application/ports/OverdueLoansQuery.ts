import type { Loan } from '../../domain/lending/Loan';

/** Outbound port, read side: open loans whose due date is before `at`. */
export interface OverdueLoansQuery {
  findOpenDueBefore(at: Date): Promise<Loan[]>;
}
