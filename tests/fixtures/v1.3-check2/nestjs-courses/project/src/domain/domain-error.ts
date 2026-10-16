export class DomainError extends Error {
  constructor(readonly code: 'invalid' | 'full' | 'missing' | 'duplicate', message: string) {
    super(message);
  }
}
