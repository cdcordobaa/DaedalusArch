/** A request the shelter refuses; the message is shown to the caller as it is. */
export class ShelterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShelterError';
  }
}
