import type { GlossaryEntry } from '../../../../domain/model/office/GlossaryEntry';
import type { Glossary } from '../../../../application/ports/out/office/Glossary';

export class InMemoryGlossary implements Glossary {
  private entries: GlossaryEntry[] = [];

  async upsert(entry: GlossaryEntry): Promise<void> {
    const same = (e: GlossaryEntry): boolean => e.clientId === entry.clientId && e.lang === entry.lang && e.term === entry.term;
    this.entries = this.entries.filter((e) => !same(e)).concat(entry);
  }

  async forClient(clientId: string, lang: string): Promise<GlossaryEntry[]> {
    return this.entries.filter((e) => e.clientId === clientId && e.lang === lang);
  }
}
