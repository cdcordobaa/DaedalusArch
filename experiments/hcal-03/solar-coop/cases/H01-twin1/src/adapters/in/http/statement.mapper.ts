import { Statement } from '../../../domain/statement';
import { StatementResponseDto } from './member.dto';

export function toStatementDto(statement: Statement): StatementResponseDto {
  return {
    memberName: statement.member.name,
    shares: statement.shares,
    totalCreditsCents: statement.totalCredits().cents,
    creditCount: statement.credits.length,
  };
}
