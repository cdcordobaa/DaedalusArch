export class DomainError extends Error {
  readonly httpStatus: number = 400;
}
export class InsufficientSharesError extends DomainError {}
export class MemberNotFoundError extends DomainError {
  override readonly httpStatus = 404;
}
export class ArrayCapacityExceededError extends DomainError {}
