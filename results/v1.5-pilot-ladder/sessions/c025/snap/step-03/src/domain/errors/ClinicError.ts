export class ClinicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClinicError';
  }
}
