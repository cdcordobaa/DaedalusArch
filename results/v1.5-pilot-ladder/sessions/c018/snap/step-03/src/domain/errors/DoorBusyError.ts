/** The door system is overloaded and asks us to wait before trying again. */
export class DoorBusyError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Please try again in a moment.');
    this.name = 'DoorBusyError';
  }
}
