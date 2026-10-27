import type { SectionRepository } from '../domain/section/SectionRepository';
import { SectionId } from '../domain/section/value-objects/SectionId';
import { EnrolmentError } from '../domain/EnrolmentError';

const DAILY_SWITCH_LIMIT = 3;

export class SwitchSection {
  constructor(private readonly sections: SectionRepository) {}

  execute(studentId: string, fromSectionId: string, toSectionId: string, day: string): void {
    const from = this.sections.byId(SectionId.of(fromSectionId));
    const to = this.sections.byId(SectionId.of(toSectionId));
    if (from === undefined || to === undefined) throw new EnrolmentError(`no section ${from === undefined ? fromSectionId : toSectionId}`);
    if (from.id.equals(to.id)) throw new EnrolmentError('a switch needs two different sections');
    if (from.courseCode !== to.courseCode) throw new EnrolmentError(`course mismatch: ${from.courseCode} to ${to.courseCode}`);
    const taken = this.sections.switchesInto(to.id, day);
    if (taken >= DAILY_SWITCH_LIMIT) throw new EnrolmentError(`daily switch limit reached: ${to.id.value} already took ${String(taken)} students by switch today`);
    from.drop(studentId, 'switched-out', to.id.value);
    to.enrol(studentId, 'switched-in', from.id.value);
    this.sections.save(from);
    this.sections.save(to);
    this.sections.recordSwitchInto(to.id, day);
  }
}
