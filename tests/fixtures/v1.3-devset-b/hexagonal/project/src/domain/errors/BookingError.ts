export class BookingError extends Error {
  constructor(readonly reason: 'not-found' | 'unavailable' | 'invalid' | 'payment-declined', message: string) {
    super(message);
    this.name = 'BookingError';
  }
}
