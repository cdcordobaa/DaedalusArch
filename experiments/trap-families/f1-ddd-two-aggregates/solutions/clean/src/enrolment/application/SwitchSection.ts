import type { SectionRepository } from '../domain/section/SectionRepository';
import { SectionId } from '../domain/section/value-objects/SectionId';
import { EnrolmentError } from '../domain/EnrolmentError';

/** Seats the student in the new section; `ReleaseSwitchedSeat` frees the old seat when the event is delivered. */
export class SwitchSection {
  constructor(private readonly sections: SectionRepository) {}

  execute(studentId: string, fromSectionId: string, toSectionId: string, day: string): string {
    const source = this.sections.byId(SectionId.of(fromSectionId));
    if (source === undefined) throw new EnrolmentError(`no section ${fromSectionId}`);
    const target = this.sections.byId(SectionId.of(toSectionId));
    if (target === undefined) throw new EnrolmentError(`no section ${toSectionId}`);
    source.assertEnrolled(studentId);
    const switchId = this.sections.nextSwitchId();
    target.acceptSwitch(switchId, studentId, source.id, source.courseCode, day);
    this.sections.save(target);
    return switchId;
  }
}
