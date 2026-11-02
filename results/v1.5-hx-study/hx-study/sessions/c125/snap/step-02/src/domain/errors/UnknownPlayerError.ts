import { EntryError } from './EntryError';

/** The rating source has no player with the given federation id. */
export class UnknownPlayerError extends EntryError {
  constructor(message = 'No player with this federation id.') {
    super(message);
    this.name = 'UnknownPlayerError';
  }
}
