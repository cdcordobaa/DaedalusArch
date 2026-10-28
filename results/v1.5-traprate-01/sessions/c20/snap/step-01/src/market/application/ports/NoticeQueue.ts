import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

/** Notices stored with the change that raised them, waiting to be handed on. */
export interface NoticeQueue {
  drain(): DomainEvent[];
}
