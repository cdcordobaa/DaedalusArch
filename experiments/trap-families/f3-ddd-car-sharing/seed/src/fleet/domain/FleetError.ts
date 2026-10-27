export class FleetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FleetError';
  }
}
