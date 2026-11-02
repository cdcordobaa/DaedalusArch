/** A refused request. Its message is what the caller is shown. */
export class LockerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LockerError';
  }
}
