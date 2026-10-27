import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class BaysRefused implements DomainEvent {
  readonly type = 'BaysRefused';

  constructor(
    readonly carParkId: string,
    readonly reservationId: string,
  ) {}
}
