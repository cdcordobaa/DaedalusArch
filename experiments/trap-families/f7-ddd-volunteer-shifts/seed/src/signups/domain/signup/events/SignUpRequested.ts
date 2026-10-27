import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class SignUpRequested implements DomainEvent {
  readonly type = 'SignUpRequested';

  constructor(
    readonly signUpId: string,
    readonly shiftId: string,
    readonly volunteer: string,
    readonly places: number,
  ) {}
}
