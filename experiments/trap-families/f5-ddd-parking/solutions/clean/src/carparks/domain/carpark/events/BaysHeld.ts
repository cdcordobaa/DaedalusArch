import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class BaysHeld implements DomainEvent {
  readonly type = 'BaysHeld';

  constructor(
    readonly carParkId: string,
    readonly reservationId: string,
  ) {}
}
