export class DomainError extends Error {}

export class CommissionNotFoundError extends DomainError {
  constructor(ref: string) {
    super(`bell commission ${ref} not found`);
  }
}

export class CommissionNotQuotedError extends DomainError {
  constructor(id: string) {
    super(`bell commission ${id} already has metal on order`);
  }
}

export class SupplierUnavailableError extends DomainError {}
