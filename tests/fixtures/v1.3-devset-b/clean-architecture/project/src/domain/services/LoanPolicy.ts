import { Loan } from '../entities/Loan';
import { Member } from '../entities/Member';
import { DomainError } from '../errors/DomainError';

export class LoanPolicy {
  assertCanBorrow(member: Member, activeLoans: readonly Loan[], now: Date): void {
    if (activeLoans.some((loan) => loan.isOverdue(now))) {
      throw new DomainError('OVERDUE_LOANS', `${member.name} has overdue loans`);
    }
    if (activeLoans.length >= member.maxActiveLoans) {
      throw new DomainError('LOAN_LIMIT', `${member.name} reached the limit of ${member.maxActiveLoans} loans`);
    }
  }
}
