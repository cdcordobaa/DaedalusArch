/** A broken business rule. The HTTP layer maps every subclass to 422 Unprocessable Entity with its `code`. */
export abstract class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
