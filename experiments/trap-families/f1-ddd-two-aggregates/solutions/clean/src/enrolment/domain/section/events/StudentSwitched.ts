import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

/** A student took a seat in this section by switch; the section they came from releases their seat on delivery. */
export class StudentSwitched implements DomainEvent {
  readonly type = 'StudentSwitched';

  constructor(
    readonly switchId: string,
    readonly studentId: string,
    readonly fromSectionId: string,
    readonly toSectionId: string,
  ) {}
}
