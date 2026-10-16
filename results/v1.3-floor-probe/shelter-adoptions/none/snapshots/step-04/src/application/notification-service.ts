import { Notification, Recipient, chooseChannel, smsText } from '../domain/notification';
import { SYSTEM_ACTOR } from '../domain/audit';
import { IdGenerator, Mailer, NotificationRepository, SmsGateway, UnitOfWork } from './ports';
import { AuditService } from './audit-service';

export class NotificationService {
  constructor(
    private readonly mailer: Mailer,
    private readonly sms: SmsGateway,
    private readonly notifications: NotificationRepository,
    private readonly ids: IdGenerator,
    private readonly audit: AuditService,
    private readonly uow: UnitOfWork,
    private readonly now: () => Date = () => new Date(),
  ) {}

  notify(actor: string, recipient: Recipient, subject: string, body: string, animalId?: string): Notification {
    const channel = chooseChannel(recipient);
    const ts = this.now().toISOString();
    const n: Notification = { id: this.ids.next(), recipient, channel, subject, body, status: 'pending', createdAt: ts, updatedAt: ts, animalId };
    this.uow.run(() => {
      this.notifications.save(n);
      this.audit.record(actor, 'notification', n.id, animalId, null, n);
    });
    if (channel === 'email') {
      this.sendEmail(n, actor);
    } else {
      this.sms
        .send(recipient.phone as string, smsText(subject, body))
        .then(({ messageId }) => this.update(n.id, { status: 'sent', providerMessageId: messageId }, SYSTEM_ACTOR))
        .catch(() => this.fallBack(n.id));
    }
    return n;
  }

  handleDeliveryReport(messageId: string, delivered: boolean): Notification | undefined {
    const n = this.notifications.findByProviderMessageId(messageId);
    if (!n) return undefined;
    if (delivered) return this.update(n.id, { status: 'delivered' }, SYSTEM_ACTOR);
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
      animalId: n.animalId,
    };
    this.uow.run(() => {
      this.notifications.save(email);
      this.audit.record(SYSTEM_ACTOR, 'notification', email.id, n.animalId, null, email);
    });
    this.sendEmail(email, SYSTEM_ACTOR);
    return this.update(n.id, { status: 'fell-back-to-email' }, SYSTEM_ACTOR);
  }

  private sendEmail(n: Notification, actor: string): void {
    this.mailer.send({ to: n.recipient.email, subject: n.subject, body: n.body });
    this.update(n.id, { status: 'delivered' }, actor);
  }

  private update(id: string, patch: Partial<Notification>, actor: string): Notification | undefined {
    const n = this.notifications.findById(id);
    if (!n) return undefined;
    const updated = { ...n, ...patch, updatedAt: this.now().toISOString() };
    return this.uow.run(() => {
      this.notifications.save(updated);
      this.audit.record(actor, 'notification', id, n.animalId, n, updated);
      return updated;
    });
  }
}
