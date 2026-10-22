/** One stored outbox row. */
export class OutboxMessage {
  constructor(readonly id: string, readonly type: string, readonly payload: string, public sentAt: Date | null = null) {}
}
