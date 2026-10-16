import { BusinessRuleError } from '../errors';

export type DayState = 'open' | 'closed' | 'settled';

export class MarketDay {
  constructor(public readonly id: string, public readonly date: string, public state: DayState = 'open') {}

  close(): void {
    if (this.state !== 'open') throw new BusinessRuleError(`market day already ${this.state}`);
    this.state = 'closed';
  }

  markSettled(): void {
    if (this.state !== 'closed') throw new BusinessRuleError('only a closed market day can be settled');
    this.state = 'settled';
  }

  ensureChangeable(): void {
    if (this.state === 'settled') throw new BusinessRuleError('market day is settled');
  }
}
