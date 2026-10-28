import { StatementResponseDto } from '../adapters/in/http/member.dto';
import { Member } from './member';
import { Money } from './money';
import { ProductionCredit } from './production-credit';

export class Statement {
  constructor(
    readonly member: Member,
    readonly shares: number,
    readonly credits: ProductionCredit[],
  ) {}
  toDto(): StatementResponseDto {
    return {
      memberName: this.member.name,
      shares: this.shares,
      totalCreditsCents: this.totalCredits().cents,
      creditCount: this.credits.length,
    };
  }
  totalCredits(): Money {
    return this.credits.reduce((sum, c) => sum.add(c.amount), Money.zero());
  }
}
