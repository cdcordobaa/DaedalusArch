export class ParkingError extends Error {
  constructor(readonly kind: 'not-found' | 'unavailable' | 'invalid', message: string) {
    super(message);
  }
}
