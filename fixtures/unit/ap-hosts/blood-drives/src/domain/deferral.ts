import { DomainError } from './domain-error';

/** Temporary deferral reasons of the donor questionnaire; permanent ones are handled by the medical team. */
export const DEFERRAL_REASONS = ['low-hemoglobin', 'recent-travel', 'tattoo', 'medication', 'illness'] as const;

export const MAX_DEFERRAL_WEEKS = 52;

export function isDeferralReason(value: string): boolean {
  return (DEFERRAL_REASONS as readonly string[]).includes(value);
}

export class UnknownDeferralReasonError extends DomainError {
  constructor(value: string) {
    super('UNKNOWN_DEFERRAL_REASON', `"${value}" is not a temporary deferral reason`);
  }
}

export class DonorDeferredError extends DomainError {
  constructor(until: Date) {
    super('DONOR_DEFERRED', `The donor is deferred until ${until.toISOString().slice(0, 10)}`);
  }
}

export class Deferral {
  readonly reason: string;
  readonly until: Date;

  constructor(reason: string, until: Date) {
    this.reason = reason;
    this.until = until;
  }

  isActiveOn(day: Date): boolean {
    return day.getTime() < this.until.getTime();
  }
}
