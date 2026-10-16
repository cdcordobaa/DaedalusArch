/** Errors of the use cases that are not business rules: bad input, missing records, races. */
export class ValidationError extends Error {
  readonly status = 400;
}

export class NotFoundError extends Error {
  readonly status = 404;
}

export class ConflictError extends Error {
  readonly status = 409;
}
