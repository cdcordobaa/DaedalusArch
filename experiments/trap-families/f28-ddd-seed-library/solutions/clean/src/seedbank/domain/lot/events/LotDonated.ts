import type { LibraryEvent } from '../../../../shared-kernel/LibraryEvent';

export class LotDonated implements LibraryEvent {
  readonly kind = 'lot-donated';

  constructor(
    readonly lot: string,
    readonly donor: string,
    readonly variety: string,
    readonly grams: number,
  ) {}
}
