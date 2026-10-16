import { Contactable, SentNotification, toSms } from '../domain/model';
import { NotificationRepository } from '../domain/ports/repositories';
import { Clock, Ids, MailProvider, SmsProvider } from './ports';

export class Notifier {
  constructor(
    private readonly mail: MailProvider,
    private readonly sms: SmsProvider,
    private readonly sent: NotificationRepository,
    private readonly clock: Clock,
    private readonly ids: Ids,
  ) {}

  async notify(to: Contactable, subject: string, body: string): Promise<SentNotification> {
    const useSms = to.channel === 'sms' && !!to.phone;
    let n: SentNotification = { id: this.ids.next(), to, channel: useSms ? 'sms' : 'email', subject, body, state: 'sent', updatedAt: this.clock.now() };
    if (useSms && to.phone) {
      try {
        const r = await this.sms.send(to.phone, toSms(subject, body));
        n = { ...n, smsId: r.messageId };
      } catch {
        n = this.fallBackToEmail(n);
      }
    } else {
      this.mail.send({ to: to.email, subject, body });
    }
    this.sent.put(n);
    return n;
  }

  /** TextBridge reports the delivery of an SMS. */
  deliveryReported(smsId: string, delivered: boolean): SentNotification | undefined {
    const n = this.sent.bySmsId(smsId);
    if (!n) return undefined;
    const next = delivered ? { ...n, state: 'delivered' as const, updatedAt: this.clock.now() } : this.fallBackToEmail({ ...n, state: 'failed' });
    this.sent.put(next);
    return next;
  }

  all(): SentNotification[] { return this.sent.all(); }

  private fallBackToEmail(n: SentNotification): SentNotification {
    this.mail.send({ to: n.to.email, subject: n.subject, body: n.body });
    return { ...n, state: 'emailed-after-sms-failure', updatedAt: this.clock.now() };
  }
}
