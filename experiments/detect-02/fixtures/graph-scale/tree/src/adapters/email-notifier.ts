import { Notifier } from '../ports/notifier';

export class EmailNotifier implements Notifier {
  async notify(to: string, text: string): Promise<void> { void to; void text; }
}
