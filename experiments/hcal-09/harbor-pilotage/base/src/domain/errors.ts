export class DomainError extends Error {}

export class JobNotFoundError extends DomainError {
  constructor(ref: string) {
    super(`pilotage job ${ref} not found`);
  }
}

export class JobNotSchedulableError extends DomainError {
  constructor(jobId: string) {
    super(`pilotage job ${jobId} is already scheduled`);
  }
}

export class TideServiceUnavailableError extends DomainError {}
