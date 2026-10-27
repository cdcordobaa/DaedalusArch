import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class ShiftOpened implements DomainEvent {
  readonly type = 'ShiftOpened';

  constructor(
    readonly shiftId: string,
    readonly name: string,
    readonly places: number,
  ) {}
}
