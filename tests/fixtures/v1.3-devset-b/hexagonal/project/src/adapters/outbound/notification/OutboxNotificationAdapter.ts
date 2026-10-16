import { NotificationSender } from '../../../application/ports/out/NotificationSender';

/** Driven adapter: writes messages to an outbox that a mail relay drains. */
export class OutboxNotificationAdapter implements NotificationSender {
  readonly outbox: { recipient: string; message: string }[] = [];

  async send(recipient: string, message: string): Promise<void> {
    this.outbox.push({ recipient, message });
  }
}
