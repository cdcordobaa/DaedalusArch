export class SpaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpaceError';
  }
}
