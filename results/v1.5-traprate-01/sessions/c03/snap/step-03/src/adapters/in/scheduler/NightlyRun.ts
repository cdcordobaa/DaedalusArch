import type { FinanceExport } from '../../../application/ports/in/FinanceExport';
import type { LowBalanceLetters } from '../../../application/ports/in/LowBalanceLetters';
import { reply, type Reply } from '../shared/reply';

/** What the scheduler starts every night after the canteen closes. */
export class NightlyRun {
  constructor(
    private readonly letters: LowBalanceLetters,
    private readonly finance: FinanceExport,
  ) {}

  lowBalanceLetters(): Reply {
    return reply(() => ({ letters: this.letters.send() }));
  }

  financeExport(date: unknown): Reply {
    return reply(() => this.finance.financeExport(date));
  }
}
