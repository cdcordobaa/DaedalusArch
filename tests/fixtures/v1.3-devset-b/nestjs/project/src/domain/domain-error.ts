export type DomainErrorKind = 'not-found' | 'conflict' | 'invalid';

export class DomainError extends Error {
  constructor(readonly kind: DomainErrorKind, message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
