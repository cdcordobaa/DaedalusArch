import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { NoticeQueue } from './ports/NoticeQueue';

type Listener = (notice: DomainEvent) => void;

/** Hands stored notices to their listeners once the change that raised them has been stored. */
export class NoticeCourier {
  private readonly listeners: { type: string; listener: Listener }[] = [];

  constructor(private readonly queue: NoticeQueue) {}

  subscribe(type: string, listener: Listener): void {
    this.listeners.push({ type, listener });
  }

  deliverPendingNotices(): void {
    for (let batch = this.queue.drain(); batch.length > 0; batch = this.queue.drain()) {
      for (const notice of batch) {
        for (const l of this.listeners) if (l.type === notice.type) l.listener(notice);
      }
    }
  }
}
