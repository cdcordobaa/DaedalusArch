export class DomainError extends Error {}

export class CallOutNotFoundError extends DomainError {
  constructor(ref: string) {
    super(`call-out ${ref} not found`);
  }
}

export class CallOutNotRequestedError extends DomainError {
  constructor(callOutId: string) {
    super(`call-out ${callOutId} is already scheduled or closed`);
  }
}

export class NoTechnicianFreeError extends DomainError {
  constructor(district: string) {
    super(`no locksmith free in ${district}`);
  }
}

export class SchedulingConflict extends DomainError {
  constructor(readonly district: string) {
    super(`the requested slot in ${district} was just taken`);
  }
}

export class SchedulingUnavailableError extends DomainError {}
