import { EntryError } from './EntryError';

/** The section already has its maximum number of players. */
export class SectionFullError extends EntryError {
  constructor(message = 'This section is full.') {
    super(message);
    this.name = 'SectionFullError';
  }
}
