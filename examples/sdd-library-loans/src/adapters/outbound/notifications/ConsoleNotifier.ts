import type { Notifier } from '../../../application/ports/Notifier';

/** Prints mails instead of sending them; keeps them for inspection. */
export class ConsoleNotifier implements Notifier {
  readonly sent: { to: string; subject: string; body: string }[] = [];

  constructor(private readonly print: (line: string) => void = (line) => console.log(line)) {}

  async send(to: string, subject: string, body: string): Promise<void> {
    this.sent.push({ to, subject, body });
    this.print(`mail to ${to}: ${subject}`);
  }
}
