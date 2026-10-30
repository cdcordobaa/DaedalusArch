/** A ticket we cannot sell. */
export class TicketError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'TicketError';
  }
}
