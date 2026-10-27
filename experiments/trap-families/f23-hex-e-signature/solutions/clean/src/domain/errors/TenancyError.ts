/** A request the lettings rules refuse; its message is shown to staff as it is. */
export class TenancyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenancyError';
  }
}
