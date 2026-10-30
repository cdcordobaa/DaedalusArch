import type { Entry, Section } from '../../../domain/model/Entry';

export interface EntryRoster {
  add(entry: Entry): Promise<void>;
  inSection(section: Section): Promise<readonly Entry[]>;
  nextNumber(): Promise<number>;
}
