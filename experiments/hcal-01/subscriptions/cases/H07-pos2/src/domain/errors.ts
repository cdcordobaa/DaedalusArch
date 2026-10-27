export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
export class HttpStatusError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}
export class PlanNotFoundError extends DomainError {}
export class SubscriptionNotFoundError extends DomainError {}
export class AlreadySubscribedError extends DomainError {}
export class AlreadyCancelledError extends DomainError {}
export class IneligibleCustomerError extends DomainError {}
export class PaymentDeclinedError extends DomainError {}
