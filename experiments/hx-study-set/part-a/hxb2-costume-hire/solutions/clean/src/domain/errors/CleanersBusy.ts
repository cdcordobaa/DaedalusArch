import { WardrobeError } from './WardrobeError';

/** The cleaners take no more costumes for now; waitHours is how long to wait, in whole hours. */
export class CleanersBusy extends WardrobeError {
  constructor(readonly waitHours: number) {
    super('the cleaners are busy');
    this.name = 'CleanersBusy';
  }
}
