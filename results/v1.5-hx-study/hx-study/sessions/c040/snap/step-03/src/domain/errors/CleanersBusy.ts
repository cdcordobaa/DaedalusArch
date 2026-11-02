import { CleaningRefused } from './CleaningRefused';

/** The cleaners are too busy to take the costume now; try again after retryInHours. */
export class CleanersBusy extends CleaningRefused {
  constructor(detail: string, readonly retryInHours: number) {
    super(detail);
    this.name = 'CleanersBusy';
  }
}
