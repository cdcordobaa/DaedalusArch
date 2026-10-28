export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
export class DonationTooSmallError extends DomainError {}
export class ShowOverlapError extends DomainError {}
export class HostUnavailableError extends DomainError {}
export class ReportUnavailableError extends DomainError {
  constructor(message: string, readonly retryable: boolean = false) {
    super(message);
  }
}
