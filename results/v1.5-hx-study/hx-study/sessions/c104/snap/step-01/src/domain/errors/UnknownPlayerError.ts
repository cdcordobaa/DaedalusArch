import { EntryError } from './EntryError';

/** The rating authority does not know the federation id. */
export class UnknownPlayerError extends EntryError {
  constructor() {
    super('No player with this federation id.');
    this.name = 'UnknownPlayerError';
  }
}
