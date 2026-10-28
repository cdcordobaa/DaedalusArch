import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class VendorCheckedIn implements DomainEvent {
  readonly type = 'VendorCheckedIn';

  constructor(
    readonly date: string,
    readonly pitch: string,
    readonly vendorId: string,
  ) {}
}
