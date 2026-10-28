import type { SectionRepository } from '../domain/section/SectionRepository';
import { SectionId } from '../domain/section/value-objects/SectionId';
import { EnrolmentError } from '../domain/EnrolmentError';

export class SwitchSection {
  constructor(private readonly sections: SectionRepository, private readonly today: () => string) {}

  /** Moves a student between two sections of one course; both sections are stored together or not at all. */
  execute(studentId: string, fromSectionId: string, toSectionId: string): void {
    const from = this.sections.byId(SectionId.of(fromSectionId));
    if (from === undefined) throw new EnrolmentError(`no section ${fromSectionId}`);
    const to = this.sections.byId(SectionId.of(toSectionId));
    if (to === undefined) throw new EnrolmentError(`no section ${toSectionId}`);
    if (from.courseCode !== to.courseCode) {
      throw new EnrolmentError(`${fromSectionId} and ${toSectionId} are sections of different courses`);
    }
    if (!from.has(studentId)) throw new EnrolmentError(`${studentId} is not enrolled in ${fromSectionId}`);
    if (fromSectionId === toSectionId) throw new EnrolmentError(`${studentId} is already enrolled in ${toSectionId}`);
    to.enrolBySwitch(studentId, this.today());
    from.drop(studentId);
    this.sections.saveAll([from, to]);
  }
}
