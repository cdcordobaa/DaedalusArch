export class DomainError extends Error {}

export class OrderNotFoundError extends DomainError {
  constructor(ref: string) {
    super(`order ${ref} not found`);
  }
}

export class OrderNotPlacedError extends DomainError {
  constructor(orderId: string) {
    super(`order ${orderId} was already sent to print`);
  }
}

export class OrderNotInProductionError extends DomainError {
  constructor(orderId: string) {
    super(`order ${orderId} is not in production`);
  }
}

export class ProductionUnavailableError extends DomainError {}

export class OrderNotDispatchedError extends DomainError {
  constructor(orderId: string) {
    super(`order ${orderId} has not been dispatched`);
  }
}
