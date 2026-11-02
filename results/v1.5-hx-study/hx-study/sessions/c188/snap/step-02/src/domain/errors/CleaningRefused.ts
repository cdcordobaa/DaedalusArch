import { WardrobeError } from './WardrobeError';

/** The cleaners would not take the costume; detail is what they said, shown to the wardrobe staff as is. */
export class CleaningRefused extends WardrobeError {
  constructor(readonly detail: string) {
    super('The cleaners refused the costume (' + detail + ')');
    this.name = 'CleaningRefused';
  }
}

/** The cleaners are too busy right now; the costume can be handed in again after retryInHours. */
export class CleaningBusy extends CleaningRefused {
  constructor(detail: string, readonly retryInHours: number) {
    super(detail);
    this.name = 'CleaningBusy';
  }
}

/** The cleaners do not take this kind of fabric; the costume has to be cleaned by hand. */
export class FabricNotAccepted extends CleaningRefused {
  constructor(detail: string) {
    super(detail);
    this.name = 'FabricNotAccepted';
  }
}
