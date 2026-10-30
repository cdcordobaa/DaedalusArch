import { EntryError } from './EntryError';

/** No rated player has this federation id. */
export class PlayerUnknown extends EntryError {
  constructor(readonly federationId: string) {
    super('No player with this federation id.');
    this.name = 'PlayerUnknown';
  }
}
