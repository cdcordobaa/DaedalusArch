import { DomainError } from './errors';

export class InsuranceDeclinedError extends DomainError {
  readonly httpStatus = 402;

  constructor(readonly loanId: string) {
    super(`Insurer declined cover for loan ${loanId}`);
  }
}
