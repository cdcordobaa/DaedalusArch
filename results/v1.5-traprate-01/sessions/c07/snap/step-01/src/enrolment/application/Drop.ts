import type { SectionRepository } from '../domain/section/SectionRepository';
import { SectionId } from '../domain/section/value-objects/SectionId';
import { EnrolmentError } from '../domain/EnrolmentError';

export class Drop {
  constructor(private readonly sections: SectionRepository) {}

  execute(sectionId: string, studentId: string): void {
    const section = this.sections.byId(SectionId.of(sectionId));
    if (section === undefined) throw new EnrolmentError(`no section ${sectionId}`);
    section.drop(studentId);
    this.sections.save(section);
  }
}
