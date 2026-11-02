import { EntryError } from './EntryError';

/** The federation id does not belong to any player; the entry form can ask for the number to be checked. */
export class UnknownPlayerError extends EntryError {
  constructor() {
    super('No player with this federation id.');
    this.name = 'UnknownPlayerError';
  }
}
