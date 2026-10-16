import { DateRange } from '../../shared/domain/date-range';
import { InsuranceValuation } from '../../loans/domain/insurance-valuation';
import { LoanAgreement, LoanStatus } from '../../loans/domain/loan-agreement';
import { LoanRecord } from '../entities/loan.entity';

export function toLoanAgreement(record: LoanRecord): LoanAgreement {
  return new LoanAgreement(
    record.id,
    record.artworkId,
    record.lenderId,
    DateRange.parse(record.startsOn, record.endsOn),
    InsuranceValuation.of(Number(record.insuredValue), record.currency),
    record.status as LoanStatus,
  );
}
