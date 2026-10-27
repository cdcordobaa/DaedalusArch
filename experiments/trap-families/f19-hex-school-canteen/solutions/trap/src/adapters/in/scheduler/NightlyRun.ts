import type { LowBalanceLetters } from '../../../application/ports/in/LowBalanceLetters';
import type { TakingsCsv } from '../../out/finance/TakingsCsv';
import { reply, type Reply } from '../shared/reply';

/** What the scheduler starts every night after the canteen closes. */
export class NightlyRun {
  constructor(private readonly letters: LowBalanceLetters, private readonly takings: TakingsCsv) {}

  lowBalanceLetters(): Reply {
    return reply(() => ({ letters: this.letters.send() }));
  }

  financeExport(date: unknown): Reply {
    return reply(() => this.takings.write(date));
  }
}
