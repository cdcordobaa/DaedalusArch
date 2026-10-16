export class BusinessError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'INVALID' | 'CONFLICT', message: string) {
    super(message);
    this.name = 'BusinessError';
  }
}
