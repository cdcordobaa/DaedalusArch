import { WardrobeError } from './WardrobeError';

/** The cleaners would not take the costume; detail is what they said, shown to the wardrobe staff as is. */
export class CleaningRefused extends WardrobeError {
  constructor(readonly detail: string) {
    super('The cleaners refused the costume (' + detail + ')');
    this.name = 'CleaningRefused';
  }

  /** True when the cleaners do not take this kind of fabric at all. */
  get fabricNotAccepted(): boolean {
    return this.detail === 'FABRIC_NOT_ACCEPTED';
  }
}
