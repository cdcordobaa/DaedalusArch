/** A booking the observatory cannot take. */
export class BookingRefused extends Error {
  constructor(message: string, readonly statusCode?: number, readonly headers: Readonly<Record<string, string>> = {}) {
    super(message);
    this.name = 'BookingRefused';
  }
}
