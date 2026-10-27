import type { LibraryEvent } from '../../../../shared-kernel/LibraryEvent';

/** Part of a lot left its garden; the receiving garden's new lot is opened from this. */
export class PortionShared implements LibraryEvent {
  readonly kind = 'portion-shared';

  constructor(
    readonly fromLot: string,
    readonly newLot: string,
    readonly toGarden: string,
    readonly variety: string,
    readonly germination: number,
    readonly grams: number,
    readonly on: string,
  ) {}
}
