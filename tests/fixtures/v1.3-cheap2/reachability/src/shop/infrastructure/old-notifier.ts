import { OldMailer } from './old-mailer';

/** PLANTED P4a: nothing reaches this module. */
export class OldNotifier {
  private readonly mailer = new OldMailer();

  notify(to: string): string {
    return this.mailer.send(to);
  }
}
