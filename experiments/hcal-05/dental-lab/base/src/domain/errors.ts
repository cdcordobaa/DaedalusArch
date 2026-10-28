export class ScanUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScanUnavailableError';
  }
}
