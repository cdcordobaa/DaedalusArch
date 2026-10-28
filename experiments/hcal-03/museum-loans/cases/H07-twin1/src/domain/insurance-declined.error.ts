import { DomainError } from './errors';

export class InsuranceDeclinedError extends DomainError {
  readonly code = 'INSURANCE_DECLINED';

  constructor(readonly loanId: string) {
    super(`Insurer declined cover for loan ${loanId}`);
  }
}
