export class DomainError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
  }
}

export const notFound = (what: string): DomainError => new DomainError(`${what} not found`, 404);
export const conflict = (msg: string): DomainError => new DomainError(msg, 409);
