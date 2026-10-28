export class DomainError extends Error {}

export class InvalidPeriodError extends DomainError {
  constructor() {
    super('Loan period end precedes its start');
  }
}

export class LoanTooLongError extends DomainError {
  constructor(readonly maxDays: number) {
    super(`Loan exceeds ${maxDays} days`);
  }
}

export class ConditionTooPoorError extends DomainError {
  constructor(readonly artworkId: string) {
    super(`Artwork ${artworkId} is not fit to travel`);
  }
}

export class LoanNotFoundError extends DomainError {
  constructor(readonly loanId: string) {
    super(`Loan ${loanId} not found`);
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super(`Cannot move a loan from ${from} to ${to}`);
  }
}
