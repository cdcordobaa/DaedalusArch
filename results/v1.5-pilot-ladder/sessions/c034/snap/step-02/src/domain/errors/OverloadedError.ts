/** The door system is overloaded and asks us to wait before trying again. */
export class OverloadedError extends Error {
  constructor(readonly retryAfterSeconds: number = 30) {
    super('Please try again in a moment.');
    this.name = 'OverloadedError';
  }
}
