import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class CarParkOpened implements DomainEvent {
  readonly type = 'CarParkOpened';

  constructor(
    readonly carParkId: string,
    readonly name: string,
    readonly bays: number,
  ) {}
}
