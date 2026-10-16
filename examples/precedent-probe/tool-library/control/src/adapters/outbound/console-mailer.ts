import type { Mailer } from '../../application/ports/mailer';

export class ConsoleMailer implements Mailer {
  readonly sent: { to: string; subject: string; body: string }[] = [];

  async send(to: string, subject: string, body: string): Promise<void> {
    this.sent.push({ to, subject, body });
    console.log(`[mail] to=${to} subject=${subject}`);
  }
}
