export class GardenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GardenError';
  }
}
