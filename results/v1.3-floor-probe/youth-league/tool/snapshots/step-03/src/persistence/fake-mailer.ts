export interface SentMail {
  to: string;
  subject: string;
  body: string;
  sentAt: string;
}

/** Fake mail provider: records the messages instead of sending them. */
export class FakeMailer {
  readonly sent: SentMail[] = [];
  send(to: string, subject: string, body: string): void {
    this.sent.push({ to, subject, body, sentAt: new Date().toISOString() });
  }
}
