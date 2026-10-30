/** A ticket we cannot sell; field names the input that was wrong, when there is one. */
export class TicketError extends Error {
  constructor(message: string, readonly field?: string) {
    super(message);
    this.name = 'TicketError';
  }
}
