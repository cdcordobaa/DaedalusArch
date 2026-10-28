import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { SectionOpened } from '../domain/section/events/SectionOpened';
import type { Notices } from './ports/Notices';

export class SendOpeningNotice {
  constructor(private readonly notices: Notices) {}

  handle(event: DomainEvent): void {
    const opened = event as SectionOpened;
    this.notices.add(opened.sectionId, `Section ${opened.sectionId} of ${opened.courseCode} is open with ${String(opened.capacity)} seats.`);
  }
}
