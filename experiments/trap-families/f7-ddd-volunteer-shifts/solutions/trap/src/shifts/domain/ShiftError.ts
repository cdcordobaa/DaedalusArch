export class ShiftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShiftError';
  }
}
