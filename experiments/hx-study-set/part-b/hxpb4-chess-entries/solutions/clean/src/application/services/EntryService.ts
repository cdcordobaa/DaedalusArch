import { EntryError } from '../../domain/errors/EntryError';
import type { Entry } from '../../domain/model/Entry';
import { SectionRules } from '../../domain/services/SectionRules';
import type { EnterTournament } from '../ports/in/EnterTournament';
import type { EntryRoster } from '../ports/out/EntryRoster';
import type { RatingLookup } from '../ports/out/RatingLookup';

export class EntryService implements EnterTournament {
  constructor(
    private readonly ratings: RatingLookup,
    private readonly entries: EntryRoster,
    private readonly rules = new SectionRules(),
  ) {}

  async enter(rawId: string, rawSection: string): Promise<Entry> {
    const section = this.rules.section(rawSection);
    const federationId = this.rules.federationId(rawId);
    const already = await this.entries.inSection(section);
    if (already.some((e) => e.federationId === federationId)) throw new EntryError('this player has already entered');
    this.rules.hasRoom(already.length);
    const player = await this.ratings.find(federationId);
    this.rules.eligible(player.rating, section);
    const entry: Entry = { ...player, entryNo: await this.entries.nextNumber(), section, feeEuros: this.rules.fee(section) };
    await this.entries.add(entry);
    return entry;
  }

  async roster(rawSection: string): Promise<readonly Entry[]> {
    const list = await this.entries.inSection(this.rules.section(rawSection));
    return [...list].sort((a, b) => b.rating - a.rating);
  }
}
