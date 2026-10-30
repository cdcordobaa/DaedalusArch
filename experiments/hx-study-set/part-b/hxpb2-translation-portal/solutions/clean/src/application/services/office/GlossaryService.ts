import { BureauError } from '../../../domain/errors/BureauError';
import type { GlossaryEntry } from '../../../domain/model/office/GlossaryEntry';
import type { Glossary } from '../../ports/out/office/Glossary';

/** Client glossaries the translators get with every brief. */
export class GlossaryService {
  constructor(private readonly glossary: Glossary) {}

  async define(clientId: string, term: string, lang: string, rendering: string): Promise<GlossaryEntry> {
    if (term.trim() === '' || rendering.trim() === '') throw new BureauError('a glossary entry needs a term and a rendering');
    const entry = { clientId, term: term.trim(), lang: lang.toLowerCase(), rendering: rendering.trim() };
    await this.glossary.upsert(entry);
    return entry;
  }

  async sheet(clientId: string, lang: string): Promise<string[]> {
    const entries = await this.glossary.forClient(clientId, lang.toLowerCase());
    return entries.sort((a, b) => a.term.localeCompare(b.term)).map((e) => e.term + ' = ' + e.rendering);
  }
}
