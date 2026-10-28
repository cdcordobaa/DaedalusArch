import type { Notifier } from '../../../application/ports/out/notifier';

export class ConsoleNotifier implements Notifier {
  async send(to: string, subject: string, body: string): Promise<void> {
    console.log(`[mail to ${to}] ${subject}: ${body}`);
  }
}
