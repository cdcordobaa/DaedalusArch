import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export class MemberJoined implements DomainEvent {
  readonly type = 'MemberJoined';

  constructor(
    readonly memberId: string,
    readonly owner: string,
    readonly boatName: string,
    readonly boatLengthM: number,
  ) {}
}

export class ContractRequested implements DomainEvent {
  readonly type = 'ContractRequested';

  constructor(
    readonly memberId: string,
    readonly pontoonId: string,
    readonly boatLengthM: number,
  ) {}
}

export class MemberResigned implements DomainEvent {
  readonly type = 'MemberResigned';

  constructor(
    readonly memberId: string,
    /** The pontoon of the berth the member held, or null. */
    readonly pontoonId: string | null,
  ) {}
}
