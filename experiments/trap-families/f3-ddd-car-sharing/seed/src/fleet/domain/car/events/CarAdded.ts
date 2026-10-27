import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class CarAdded implements DomainEvent {
  readonly type = 'CarAdded';

  constructor(
    readonly carId: string,
    readonly plate: string,
    readonly zone: string,
  ) {}
}
