export class FlightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlightError';
  }
}
