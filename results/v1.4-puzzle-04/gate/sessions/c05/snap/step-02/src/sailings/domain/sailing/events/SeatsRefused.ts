import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class SeatsRefused implements DomainEvent {
  readonly type = 'SeatsRefused';

  constructor(
    readonly sailingId: string,
    readonly holder: string,
    readonly seats: number,
  ) {}
}
