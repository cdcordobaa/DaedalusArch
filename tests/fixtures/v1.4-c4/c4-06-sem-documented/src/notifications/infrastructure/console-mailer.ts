import type { Mailer } from '../application/mailer';

export class ConsoleMailer implements Mailer {
  readonly sent: string[] = [];

  send(to: string, subject: string, body: string): Promise<void> {
    this.sent.push(`${to}|${subject}|${body}`);
    return Promise.resolve();
  }
}
