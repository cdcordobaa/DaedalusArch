/** A request the bureau turns down. */
export class BureauError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BureauError';
  }
}
