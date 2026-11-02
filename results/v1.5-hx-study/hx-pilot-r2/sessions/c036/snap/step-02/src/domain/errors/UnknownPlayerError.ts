import { EntryError } from './EntryError';

/** The federation has no player with the given id. */
export class UnknownPlayerError extends EntryError {
  readonly statusCode = 404;
  constructor() {
    super('No player with this federation id.');
    this.name = 'UnknownPlayerError';
  }
}
