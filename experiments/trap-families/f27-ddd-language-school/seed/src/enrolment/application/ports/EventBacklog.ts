import type { SchoolEvent } from '../../../shared-kernel/SchoolEvent';

/** Facts stored with the change that raised them and not yet handed on. */
export interface EventBacklog {
  drainUnsent(): SchoolEvent[];
}
