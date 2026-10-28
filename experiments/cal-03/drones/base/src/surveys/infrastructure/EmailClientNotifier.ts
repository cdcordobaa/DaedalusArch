import type { ClientNotifier } from '../application/ports/ClientNotifier';

export class EmailClientNotifier implements ClientNotifier {
  readonly sent: string[] = [];

  notifyBooked(clientEmail: string, surveyId: string): void {
    this.sent.push(`${clientEmail}:${surveyId}`);
  }
}
