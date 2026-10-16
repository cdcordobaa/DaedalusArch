export class DomainError extends Error {
  constructor(
    readonly kind: "validation" | "not-found" | "conflict" | "rejected",
    message: string,
  ) {
    super(message);
  }
}
