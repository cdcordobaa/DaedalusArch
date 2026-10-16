import { Notification, Recipient, chooseChannel, smsText } from '../domain/notification';
import { IdGenerator, Mailer, NotificationRepository, SmsGateway } from './ports';

export class NotificationService {
  constructor(
    private readonly mailer: Mailer,
    private readonly sms: SmsGateway,
    private readonly notifications: NotificationRepository,
    private readonly ids: IdGenerator,
    private readonly now: () => Date = () => new Date(),
  ) {}

  notify(recipient: Recipient, subject: string, body: string): Notification {
    const channel = chooseChannel(recipient);
    const ts = this.now().toISOString();
    const n: Notification = { id: this.ids.next(), recipient, channel, subject, body, status: 'pending', createdAt: ts, updatedAt: ts };
    this.notifications.save(n);
    if (channel === 'email') {
      this.sendEmail(n);
    } else {
      this.sms
        .send(recipient.phone as string, smsText(subject, body))
        .then(({ messageId }) => this.update(n.id, { status: 'sent', providerMessageId: messageId }))
        .catch(() => this.fallBack(n.id));
    }
    return n;
  }

  handleDeliveryReport(messageId: string, delivered: boolean): Notification | undefined {
    const n = this.notifications.findByProviderMessageId(messageId);
    if (!n) return undefined;
    if (delivered) return this.update(n.id, { status: 'delivered' });
    return this.fallBack(n.id);
  }

  list(): Notification[] {
    return this.notifications.findAll();
  }

  private fallBack(id: string): Notification | undefined {
    const n = this.notifications.findById(id);
    if (!n) return undefined;
    const ts = this.now().toISOString();
    const email: Notification = {
      id: this.ids.next(),
      recipient: n.recipient,
      channel: 'email',
      subject: n.subject,
      body: n.body,
      status: 'pending',
      createdAt: ts,
      updatedAt: ts,
      fallbackOf: n.id,
    };
    this.notifications.save(email);
    this.sendEmail(email);
    return this.update(n.id, { status: 'fell-back-to-email' });
  }

  private sendEmail(n: Notification): void {
    this.mailer.send({ to: n.recipient.email, subject: n.subject, body: n.body });
    this.update(n.id, { status: 'delivered' });
  }

  private update(id: string, patch: Partial<Notification>): Notification | undefined {
    const n = this.notifications.findById(id);
    if (!n) return undefined;
    const updated = { ...n, ...patch, updatedAt: this.now().toISOString() };
    this.notifications.save(updated);
    return updated;
  }
}
