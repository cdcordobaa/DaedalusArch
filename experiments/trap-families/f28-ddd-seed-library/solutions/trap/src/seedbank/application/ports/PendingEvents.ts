import type { LibraryEvent } from '../../../shared-kernel/LibraryEvent';

/** Events kept with the change that raised them, not yet passed on. */
export interface PendingEvents {
  drain(): LibraryEvent[];
}
