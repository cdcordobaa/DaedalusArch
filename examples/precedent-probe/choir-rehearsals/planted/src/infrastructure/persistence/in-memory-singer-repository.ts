import type { Section, Singer } from '../../domain/singer';
import type { SingerRepository } from '../../domain/singer-repository';

export class InMemorySingerRepository implements SingerRepository {
  private readonly rows = new Map<string, Singer>();

  async findById(id: string): Promise<Singer | undefined> {
    return this.rows.get(id);
  }

  async findBySection(section: Section): Promise<Singer[]> {
    return [...this.rows.values()].filter((s) => s.section === section);
  }

  async save(singer: Singer): Promise<void> {
    this.rows.set(singer.id, singer);
  }
}
