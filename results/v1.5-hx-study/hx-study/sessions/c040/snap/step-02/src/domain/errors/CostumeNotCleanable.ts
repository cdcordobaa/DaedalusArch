import { CleaningRefused } from './CleaningRefused';

/** The cleaners will not take this costume's fabric; it has to be cleaned by hand. */
export class CostumeNotCleanable extends CleaningRefused {
  constructor(detail: string) {
    super(detail);
    this.name = 'CostumeNotCleanable';
  }
}
