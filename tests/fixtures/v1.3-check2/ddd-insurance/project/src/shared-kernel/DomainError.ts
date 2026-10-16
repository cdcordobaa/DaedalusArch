export class DomainError extends Error {
  constructor(readonly reason: 'not-found' | 'rejected' | 'invalid', message: string) {
    super(message);
  }
}
