import { EntryError } from './EntryError';

/** The federation has no player with this id. */
export class UnknownPlayerError extends EntryError {
  constructor() {
    super('No player with this federation id.');
    this.name = 'UnknownPlayerError';
  }
}
