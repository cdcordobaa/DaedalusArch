import { EntryError } from '../errors/EntryError';
import type { Section } from '../model/Entry';

const AMATEUR_BELOW = 1800;
const FEES: Readonly<Record<Section, number>> = { open: 35, amateur: 25 };

/** Who may play in which section, and what it costs. */
export class SectionRules {
  section(raw: string): Section {
    const s = raw.trim().toLowerCase();
    if (s !== 'open' && s !== 'amateur') throw new EntryError('the sections are open and amateur');
    return s;
  }

  federationId(raw: string): string {
    const id = raw.trim();
    if (!/^\d{6,9}$/.test(id)) throw new EntryError('a federation id has 6 to 9 digits');
    return id;
  }

  eligible(rating: number, section: Section): void {
    if (section === 'amateur' && rating >= AMATEUR_BELOW) throw new EntryError('the amateur section is for ratings under ' + String(AMATEUR_BELOW));
  }

  fee(section: Section): number {
    return FEES[section];
  }
}
