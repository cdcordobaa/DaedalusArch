import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class SectionOpened implements DomainEvent {
  readonly type = 'SectionOpened';

  constructor(
    readonly sectionId: string,
    readonly courseCode: string,
    readonly capacity: number,
  ) {}
}
