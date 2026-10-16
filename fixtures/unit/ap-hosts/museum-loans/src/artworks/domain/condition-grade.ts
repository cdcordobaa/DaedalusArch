import { DomainError } from '../../shared/domain/domain-error';

/** Condition grades of the registrar's handbook, best first. */
export const CONDITION_GRADES = ['excellent', 'good', 'fair', 'poor'] as const;

export type ConditionGrade = (typeof CONDITION_GRADES)[number];

export function isConditionGrade(value: string): value is ConditionGrade {
  return (CONDITION_GRADES as readonly string[]).includes(value);
}

export class InvalidConditionGradeError extends DomainError {
  constructor(value: string) {
    super('INVALID_CONDITION_GRADE', `"${value}" is not a condition grade (expected one of ${CONDITION_GRADES.join(', ')})`);
  }
}

/** True when `after` is worse than `before`: the lender must be notified. */
export function hasDeteriorated(before: string, after: string): boolean {
  return CONDITION_GRADES.indexOf(after as ConditionGrade) > CONDITION_GRADES.indexOf(before as ConditionGrade);
}
