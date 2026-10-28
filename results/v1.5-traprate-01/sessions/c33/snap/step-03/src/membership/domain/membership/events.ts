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
