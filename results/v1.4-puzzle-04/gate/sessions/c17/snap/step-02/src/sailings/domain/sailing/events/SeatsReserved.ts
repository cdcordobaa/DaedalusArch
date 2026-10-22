import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class SeatsReserved implements DomainEvent {
  readonly type = 'SeatsReserved';

  constructor(
    readonly sailingId: string,
    readonly holder: string,
  ) {}
}
