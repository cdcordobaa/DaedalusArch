/** A ticket we cannot sell; field names the input that was wrong, when there is one. */
export class TicketError extends Error {
  constructor(message: string, readonly field?: string, readonly statusCode: number = 400, readonly headers: Record<string, string> = {}) {
    super(message);
    this.name = 'TicketError';
  }
}
