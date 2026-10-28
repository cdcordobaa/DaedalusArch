import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export class PontoonClosed implements DomainEvent {
  readonly type = 'PontoonClosed';

  constructor(readonly pontoonId: string) {}
}

export class PontoonAdded implements DomainEvent {
  readonly type = 'PontoonAdded';

  constructor(
    readonly pontoonId: string,
    readonly name: string,
    readonly berthLengthsM: readonly number[],
  ) {}
}
