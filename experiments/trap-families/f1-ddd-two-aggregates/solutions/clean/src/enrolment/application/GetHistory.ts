import type { SectionRepository } from '../domain/section/SectionRepository';
import { SectionId } from '../domain/section/value-objects/SectionId';
import { EnrolmentError } from '../domain/EnrolmentError';

export interface HistoryLine {
  readonly kind: string;
  readonly studentId: string;
  readonly otherSection: string | null;
}

export class GetHistory {
  constructor(private readonly sections: SectionRepository) {}

  execute(sectionId: string): HistoryLine[] {
    const section = this.sections.byId(SectionId.of(sectionId));
    if (section === undefined) throw new EnrolmentError(`no section ${sectionId}`);
    return section.history().map((c) => ({ kind: c.kind, studentId: c.studentId, otherSection: c.otherSection }));
  }
}
