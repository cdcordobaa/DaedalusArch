/** A ride request we refuse, with the reason for the rider. */
export class RideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RideError';
  }
}
