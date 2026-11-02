import { EntryError } from './EntryError';

/** The rating authority has no player with the given federation id. */
export class UnknownPlayerError extends EntryError {
  constructor() {
    super('No player with this federation id.');
    this.name = 'UnknownPlayerError';
  }
}
