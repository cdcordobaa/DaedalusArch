export class WorkshopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkshopError';
  }
}
