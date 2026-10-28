/** A request the canteen refuses; the message is shown to the person who asked. */
export class CanteenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanteenError';
  }
}
