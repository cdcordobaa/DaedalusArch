import { Member } from './member';
import { Money } from './money';
import { ProductionCredit } from './production-credit';

export class Statement {
  constructor(
    readonly member: Member,
    readonly shares: number,
    readonly credits: ProductionCredit[],
  ) {}
  totalCredits(): Money {
    return this.credits.reduce((sum, c) => sum.add(c.amount), Money.zero());
  }
}
