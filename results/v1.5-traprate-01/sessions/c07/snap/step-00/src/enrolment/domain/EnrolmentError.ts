export class EnrolmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnrolmentError';
  }
}
