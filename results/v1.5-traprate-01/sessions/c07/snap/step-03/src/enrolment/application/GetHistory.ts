import type { SectionRepository } from '../domain/section/SectionRepository';
import type { HistoryItem } from '../domain/section/Section';
import { SectionId } from '../domain/section/value-objects/SectionId';
import { EnrolmentError } from '../domain/EnrolmentError';

export class GetHistory {
  constructor(private readonly sections: SectionRepository) {}

  /** Every roster change of the section, newest first. */
  execute(sectionId: string): HistoryItem[] {
    const section = this.sections.byId(SectionId.of(sectionId));
    if (section === undefined) throw new EnrolmentError(`no section ${sectionId}`);
    return section.history();
  }
}
