import { EntryError } from './EntryError';

/** The federation id belongs to no known player. */
export class UnknownPlayerError extends EntryError {
  constructor() {
    super('No player with this federation id.');
    this.name = 'UnknownPlayerError';
  }
}
