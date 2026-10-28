export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string = 'DOMAIN_ERROR',
  ) {
    super(message);
  }
}
export class InsufficientSharesError extends DomainError {}
export class MemberNotFoundError extends DomainError {
  constructor(memberId: string) {
    super(`member ${memberId} unknown`, 'MEMBER_UNKNOWN');
  }
}
export class ArrayCapacityExceededError extends DomainError {}
