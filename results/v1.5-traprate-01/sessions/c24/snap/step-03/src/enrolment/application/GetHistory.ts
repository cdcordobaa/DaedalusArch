import type { HistoryEntry } from '../domain/section/Section';
import type { SectionRepository } from '../domain/section/SectionRepository';
import { SectionId } from '../domain/section/value-objects/SectionId';
import { EnrolmentError } from '../domain/EnrolmentError';

export class GetHistory {
  constructor(private readonly sections: SectionRepository) {}

  /** Every roster change of a section, newest first. */
  execute(sectionId: string): HistoryEntry[] {
    const section = this.sections.byId(SectionId.of(sectionId));
    if (section === undefined) throw new EnrolmentError(`no section ${sectionId}`);
    return section.history();
  }
}
