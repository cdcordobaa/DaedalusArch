import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export class PontoonAdded implements DomainEvent {
  readonly type = 'PontoonAdded';

  constructor(
    readonly pontoonId: string,
    readonly name: string,
    readonly berthLengthsM: readonly number[],
  ) {}
}
