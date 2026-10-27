import type { Section } from './Section';
import type { SectionId } from './value-objects/SectionId';

export interface SectionRepository {
  nextId(): SectionId;
  byId(id: SectionId): Section | undefined;
  /** Stores the section and its pending events in one step. */
  save(section: Section): void;
  switchesInto(sectionId: SectionId, day: string): number;
  recordSwitchInto(sectionId: SectionId, day: string): void;
}
