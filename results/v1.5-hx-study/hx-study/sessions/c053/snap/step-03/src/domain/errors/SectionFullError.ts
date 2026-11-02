import { EntryError } from './EntryError';

/** The section already has its maximum number of players. */
export class SectionFullError extends EntryError {
  constructor() {
    super('This section is full.');
    this.name = 'SectionFullError';
  }
}
