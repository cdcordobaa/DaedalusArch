import type { Entry, Section } from '../../../domain/model/Entry';
import type { EntryRoster } from '../../../application/ports/out/EntryRoster';

export class InMemoryEntryRoster implements EntryRoster {
  private readonly rows: Entry[] = [];
  private counter = 0;

  async add(entry: Entry): Promise<void> {
    this.rows.push(entry);
  }

  async inSection(section: Section): Promise<readonly Entry[]> {
    return this.rows.filter((r) => r.section === section);
  }

  async nextNumber(): Promise<number> {
    this.counter += 1;
    return this.counter;
  }
}
