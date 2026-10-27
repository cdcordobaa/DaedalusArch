import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { StudentSwitched } from '../domain/section/events/StudentSwitched';
import type { SectionRepository } from '../domain/section/SectionRepository';
import { SectionId } from '../domain/section/value-objects/SectionId';
import { EnrolmentError } from '../domain/EnrolmentError';

export class ReleaseSwitchedSeat {
  constructor(private readonly sections: SectionRepository) {}

  handle(event: DomainEvent): void {
    const switched = event as StudentSwitched;
    const source = this.sections.byId(SectionId.of(switched.fromSectionId));
    if (source === undefined) throw new EnrolmentError(`no section ${switched.fromSectionId}`);
    source.releaseSwitched(switched.switchId, switched.studentId, SectionId.of(switched.toSectionId));
    this.sections.save(source);
  }
}
