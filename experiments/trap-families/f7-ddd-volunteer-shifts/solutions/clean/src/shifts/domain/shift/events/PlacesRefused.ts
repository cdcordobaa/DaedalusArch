import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class PlacesRefused implements DomainEvent {
  readonly type = 'PlacesRefused';

  constructor(
    readonly shiftId: string,
    readonly signUpId: string,
  ) {}
}
