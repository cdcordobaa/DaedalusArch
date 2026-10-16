export type LendingErrorCode = 'NOT_FOUND' | 'INVALID' | 'CONFLICT';

export class LendingError extends Error {
  constructor(readonly code: LendingErrorCode, message: string) {
    super(message);
  }
}
