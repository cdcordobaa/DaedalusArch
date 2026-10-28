import { Section } from '../domain/section/Section';
import type { SectionRepository } from '../domain/section/SectionRepository';

export class OpenSection {
  constructor(private readonly sections: SectionRepository) {}

  execute(courseCode: string, capacity: number): string {
    const section = Section.open(this.sections.nextId(), courseCode, capacity);
    this.sections.save(section);
    return section.id.value;
  }
}
