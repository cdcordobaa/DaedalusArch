import type { Section } from './Section';
import type { SectionId } from './value-objects/SectionId';

export interface SectionRepository {
  nextId(): SectionId;
  byId(id: SectionId): Section | undefined;
  /** Stores the section and its pending events in one step. */
  save(section: Section): void;
  /** Stores several sections and their pending events in one step: all of them or none. */
  saveAll(sections: readonly Section[]): void;
}
