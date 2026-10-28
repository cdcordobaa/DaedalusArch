import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class CarParkClosed implements DomainEvent {
  readonly type = 'CarParkClosed';

  constructor(readonly carParkId: string) {}
}
