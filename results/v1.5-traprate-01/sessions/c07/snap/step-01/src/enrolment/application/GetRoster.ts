import type { SectionRepository } from '../domain/section/SectionRepository';
import { SectionId } from '../domain/section/value-objects/SectionId';
import { EnrolmentError } from '../domain/EnrolmentError';

export class GetRoster {
  constructor(private readonly sections: SectionRepository) {}

  execute(sectionId: string): string[] {
    const section = this.sections.byId(SectionId.of(sectionId));
    if (section === undefined) throw new EnrolmentError(`no section ${sectionId}`);
    return section.roster();
  }
}
