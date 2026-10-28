import { Notifier } from '../../../application/ports/out/notifier.port';

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
}

export class EmailNotifier implements Notifier {
  readonly outbox: EmailMessage[] = [];
  async notify(memberId: string, subject: string, body: string): Promise<void> {
    this.outbox.push({ to: memberId, subject, body });
  }
}
