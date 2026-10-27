import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class SignUpWithdrawn implements DomainEvent {
  readonly type = 'SignUpWithdrawn';

  constructor(
    readonly signUpId: string,
    readonly shiftId: string,
  ) {}
}
