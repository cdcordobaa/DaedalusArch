import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export class PontoonAdded implements DomainEvent {
  readonly type = 'PontoonAdded';

  constructor(
    readonly pontoonId: string,
    readonly name: string,
    readonly berthLengthsM: readonly number[],
  ) {}
}

export class BerthGranted implements DomainEvent {
  readonly type = 'BerthGranted';

  constructor(
    readonly pontoonId: string,
    readonly memberId: string,
    readonly berth: number,
    readonly lengthM: number,
  ) {}
}

export class BerthRefused implements DomainEvent {
  readonly type = 'BerthRefused';

  constructor(
    readonly pontoonId: string,
    readonly memberId: string,
  ) {}
}

export class PontoonClosed implements DomainEvent {
  readonly type = 'PontoonClosed';

  constructor(
    readonly pontoonId: string,
    readonly occupants: readonly string[],
  ) {}
}
