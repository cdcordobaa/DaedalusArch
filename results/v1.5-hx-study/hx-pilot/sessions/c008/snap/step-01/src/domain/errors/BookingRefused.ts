/** A booking the observatory cannot take. */
export class BookingRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingRefused';
  }
}
