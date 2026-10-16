export * from '../persistence/models';

export class BusinessError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}
