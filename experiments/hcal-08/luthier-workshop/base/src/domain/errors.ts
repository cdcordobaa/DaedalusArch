export class DomainError extends Error {}

export class JobNotFoundError extends DomainError {
  constructor(ref: string) {
    super(`repair job ${ref} not found`);
  }
}

export class JobNotBookedError extends DomainError {
  constructor(jobId: string) {
    super(`repair job ${jobId} already has parts on order`);
  }
}

export class SupplierUnavailableError extends DomainError {}
