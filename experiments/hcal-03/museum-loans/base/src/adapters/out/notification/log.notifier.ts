import { Notifier } from '../../../application/ports/out/notifier.port';

export class LogNotifier implements Notifier {
  readonly sent: string[] = [];

  async notifyBorrower(borrower: string, message: string): Promise<void> {
    this.sent.push(`${borrower}: ${message}`);
  }
}
