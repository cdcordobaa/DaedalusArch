/** Use-case failures that are not business rules: malformed input, unknown ids, payment refusals. */
export class ValidationError extends Error {
  readonly status = 400;
}

export class NotFoundError extends Error {
  readonly status = 404;
}

export class PaymentDeclinedError extends Error {
  readonly status = 402;
}
