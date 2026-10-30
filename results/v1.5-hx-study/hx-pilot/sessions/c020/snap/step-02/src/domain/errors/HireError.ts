export class HireError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HireError';
  }
}
