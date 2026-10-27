import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class RoomOpened implements DomainEvent {
  readonly type = 'RoomOpened';

  constructor(
    readonly roomId: string,
    readonly name: string,
    readonly site: string,
    readonly seats: number,
  ) {}
}
