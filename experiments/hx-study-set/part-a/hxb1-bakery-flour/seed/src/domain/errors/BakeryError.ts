export class BakeryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BakeryError';
  }
}
