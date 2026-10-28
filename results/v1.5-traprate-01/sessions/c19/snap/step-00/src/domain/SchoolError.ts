/** A request the music school refuses; the message is shown to the caller as it is. */
export class SchoolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchoolError';
  }
}
