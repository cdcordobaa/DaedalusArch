export class WardrobeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WardrobeError';
  }
}
