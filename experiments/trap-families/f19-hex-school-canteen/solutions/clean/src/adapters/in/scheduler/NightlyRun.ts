import type { LowBalanceLetters } from '../../../application/ports/in/LowBalanceLetters';
import type { TakingsExport } from '../../../application/ports/in/TakingsExport';
import { reply, type Reply } from './reply';

/** What the scheduler starts every night after the canteen closes. */
export class NightlyRun {
  constructor(private readonly letters: LowBalanceLetters, private readonly takings: TakingsExport) {}

  lowBalanceLetters(): Reply {
    return reply(() => ({ letters: this.letters.send() }));
  }

  financeExport(date: unknown): Reply {
    return reply(() => this.takings.exportDay(date));
  }
}
