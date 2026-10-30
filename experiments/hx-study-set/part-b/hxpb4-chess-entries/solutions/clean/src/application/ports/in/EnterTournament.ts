import type { Entry } from '../../../domain/model/Entry';

export interface EnterTournament {
  enter(federationId: string, section: string): Promise<Entry>;
  roster(section: string): Promise<readonly Entry[]>;
}
