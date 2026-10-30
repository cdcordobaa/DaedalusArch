import type { GlossaryEntry } from '../../../../domain/model/office/GlossaryEntry';

export interface Glossary {
  upsert(entry: GlossaryEntry): Promise<void>;
  forClient(clientId: string, lang: string): Promise<GlossaryEntry[]>;
}
