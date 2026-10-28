export class DomainError extends Error {}
export class AppointmentNotFoundError extends DomainError {}
export class AppointmentNotCancellableError extends DomainError {}
export class LateCancellationError extends DomainError {}
export class InvoiceNotFoundError extends DomainError {}
export class ClaimsUnavailableError extends DomainError {}
