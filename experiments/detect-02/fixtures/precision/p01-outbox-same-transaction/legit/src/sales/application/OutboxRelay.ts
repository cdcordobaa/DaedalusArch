import type { EventBus } from './ports/EventBus';
import type { Outbox } from './ports/Outbox';

/** Publishes stored events after their transaction committed (at-least-once). */
export class OutboxRelay {
  constructor(private readonly outbox: Outbox, private readonly bus: EventBus) {}

  async deliver(): Promise<number> {
    const batch = await this.outbox.takePending(100);
    for (const e of batch) await this.bus.publish(e);
    return batch.length;
  }
}
