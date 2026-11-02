import { WardrobeError } from './WardrobeError';

/** The cleaners would not take the costume; detail is what they said, shown to the wardrobe staff as is. */
export class CleaningRefused extends WardrobeError {
  constructor(readonly detail: string, readonly waitMin?: number) {
    super('The cleaners refused the costume (' + detail + ')');
    this.name = 'CleaningRefused';
  }

  /** True when the cleaners are too busy right now. */
  get queueFull(): boolean {
    return this.detail === 'QUEUE_FULL';
  }

  /** Whole hours to wait before retrying; 4 when the cleaners did not say. */
  get retryInHours(): number {
    return typeof this.waitMin === 'number' && Number.isFinite(this.waitMin) && this.waitMin >= 0
      ? Math.ceil(this.waitMin / 60)
      : 4;
  }

  /** True when the cleaners do not take this kind of fabric at all. */
  get fabricNotAccepted(): boolean {
    return this.detail === 'FABRIC_NOT_ACCEPTED';
  }
}
