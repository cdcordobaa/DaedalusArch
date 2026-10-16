import { Notification, Recipient, smsText } from '../domain/notification';
import { DeliveryReports, Notifier } from '../ports/in/notifications';
import { Mailer } from '../ports/out/mailer';
import { SmsGateway } from '../ports/out/sms';
import { NotificationRepository } from '../ports/out/repositories';
import { Clock, IdGenerator } from '../ports/out/clock';

export class NotificationService implements Notifier, DeliveryReports {
  constructor(
    private readonly mailer: Mailer,
    private readonly sms: SmsGateway,
    private readonly repo: NotificationRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async notify(to: Recipient, subject: string, body: string): Promise<Notification> {
    const now = this.clock.now();
    const n: Notification = {
      id: this.ids.next('ntf'), recipient: to, channel: to.preferredChannel === 'sms' && to.phone ? 'sms' : 'email',
      subject, body, status: 'sent', createdAt: now, updatedAt: now,
    };
    if (n.channel === 'sms' && to.phone) {
      try {
        n.providerMessageId = await this.sms.send(to.phone, smsText(subject, body));
      } catch {
        this.fallback(n);
      }
    } else {
      this.mailer.send(to.email, subject, body);
    }
    this.repo.save(n);
    return n;
  }

  reportDelivery(providerMessageId: string, delivered: boolean): Notification | undefined {
    const n = this.repo.byProviderId(providerMessageId);
    if (!n) return undefined;
    if (delivered) {
      n.status = 'delivered';
      n.updatedAt = this.clock.now();
    } else {
      this.fallback(n);
    }
    this.repo.save(n);
    return n;
  }

  listNotifications(): Notification[] { return this.repo.list(); }

  private fallback(n: Notification): void {
    this.mailer.send(n.recipient.email, n.subject, n.body);
    n.status = 'fallback-email';
    n.updatedAt = this.clock.now();
  }
}
