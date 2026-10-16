export class DomainError extends Error {
  readonly kind: "validation" | "not_found" | "conflict";

  constructor(kind: "validation" | "not_found" | "conflict", message: string) {
    super(message);
    this.kind = kind;
  }
}

export const validation = (m: string): DomainError => new DomainError("validation", m);
export const notFound = (m: string): DomainError => new DomainError("not_found", m);
export const conflict = (m: string): DomainError => new DomainError("conflict", m);
