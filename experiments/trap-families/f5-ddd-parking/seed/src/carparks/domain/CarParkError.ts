export class CarParkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CarParkError';
  }
}
