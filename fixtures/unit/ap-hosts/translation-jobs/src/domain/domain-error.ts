/** A broken business rule of the agency; inbound adapters answer 422 with `code`. */
export abstract class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
