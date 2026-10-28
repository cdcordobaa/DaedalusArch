import { DomainEvent } from '../../../shared-kernel/DomainEvent';

export class ProductionOpened implements DomainEvent {
  readonly name = 'ProductionOpened';
  readonly occurredAt = Date.now();

  constructor(
    readonly productionId: string,
    readonly roomId: string,
    readonly firstShowAt: number,
  ) {}
}
