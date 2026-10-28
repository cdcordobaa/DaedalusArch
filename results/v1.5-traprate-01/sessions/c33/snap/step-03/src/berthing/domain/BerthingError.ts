export class BerthingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BerthingError';
  }
}
