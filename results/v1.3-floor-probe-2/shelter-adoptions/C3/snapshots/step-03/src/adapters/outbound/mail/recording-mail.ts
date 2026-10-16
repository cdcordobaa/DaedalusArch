import { MailProvider } from '../../../application/ports';

/** Fake mail provider: keeps every message instead of sending it. */
export class RecordingMailProvider implements MailProvider {
  readonly messages: { to: string; subject: string; body: string; sentAt: string }[] = [];
  send(message: { to: string; subject: string; body: string }): void {
    this.messages.push({ ...message, sentAt: new Date().toISOString() });
  }
}
