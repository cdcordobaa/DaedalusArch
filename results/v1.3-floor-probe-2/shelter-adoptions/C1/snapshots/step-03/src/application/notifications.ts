import { Addressee, Notification } from '../domain/notification';
import { NotificationStatus } from './ports/inbound';
import { Clock, EmailSender, IdFactory, NotificationStore, SmsSender } from './ports/outbound';

/** Sends a notification on the channel the person chose; failed SMS fall back to e-mail. */
export class NotificationService implements NotificationStatus {
  constructor(
    private readonly email: EmailSender,
    private readonly sms: SmsSender,
    private readonly store: NotificationStore,
    private readonly clock: Clock,
    private readonly ids: IdFactory,
  ) {}

  async notify(to: Addressee, subject: string, text: string): Promise<Notification> {
    const channel = to.notifyBy === 'sms' && to.phone ? 'sms' : 'email';
    const n = new Notification(this.ids.newId(), to, channel, subject, text, this.clock.nowIso());
    if (channel === 'email') {
      this.email.send(to.email, subject, text);
    } else {
      try {
        n.providerId = await this.sms.send(to.phone as string, Notification.smsBody(subject, text));
      } catch {
        this.resendByEmail(n);
      }
    }
    this.store.save(n);
    return n;
  }

  async deliveryReport(providerMessageId: string, status: 'delivered' | 'failed'): Promise<void> {
    const n = this.store.byProviderId(providerMessageId);
    if (!n) return;
    if (status === 'delivered') n.setDelivery('delivered', this.clock.nowIso());
    else this.resendByEmail(n);
    this.store.save(n);
  }

  list(): Notification[] { return this.store.all(); }

  private resendByEmail(n: Notification): void {
    this.email.send(n.to.email, n.subject, n.text);
    n.setDelivery('failed-resent-by-email', this.clock.nowIso());
  }
}
