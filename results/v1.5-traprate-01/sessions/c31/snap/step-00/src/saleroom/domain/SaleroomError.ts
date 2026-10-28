export class SaleroomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaleroomError';
  }
}
