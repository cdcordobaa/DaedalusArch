import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class PitchBooked implements DomainEvent {
  readonly type = 'PitchBooked';

  constructor(
    readonly ref: string,
    readonly date: string,
    readonly pitch: string,
    readonly vendorId: string,
  ) {}
}
