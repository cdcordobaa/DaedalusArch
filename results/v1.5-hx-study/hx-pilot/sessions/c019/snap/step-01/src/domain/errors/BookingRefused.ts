/** A booking the observatory cannot take. */
export class BookingRefused extends Error {
  constructor(message: string, readonly statusCode?: number) {
    super(message);
    this.name = 'BookingRefused';
  }
}
