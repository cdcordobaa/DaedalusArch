import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class PlacesHeld implements DomainEvent {
  readonly type = 'PlacesHeld';

  constructor(
    readonly shiftId: string,
    readonly signUpId: string,
  ) {}
}
