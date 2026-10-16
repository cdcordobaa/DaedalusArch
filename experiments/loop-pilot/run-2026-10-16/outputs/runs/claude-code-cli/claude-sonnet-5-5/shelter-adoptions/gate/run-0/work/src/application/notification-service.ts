import { NotFoundError, ValidationError } from "../domain/errors.js";
import {
  toSmsText,
  type Notification,
  type NotificationChannel,
  type NotificationStatus,
} from "../domain/notification.js";
import { SYSTEM_ACTOR } from "../domain/audit.js";
import type { ChangeStore, Clock, IdGenerator, MailPort, NotificationRepository, SmsPort } from "./ports.js";

export interface NotificationRecipient {
  name: string;
  email: string;
  phone: string;
  notificationChannel?: NotificationChannel;
}

export interface DeliveryReport {
  messageId: string;
  status: "delivered" | "failed";
  reason?: string;
}

export class NotificationService {
  constructor(
    private readonly mail: MailPort,
    private readonly sms: SmsPort,
    private readonly notifications: NotificationRepository,
    private readonly changes: ChangeStore,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /** Sends via the recipient's preferred channel; SMS failures fall back to e-mail. */
  async notify(
    recipient: NotificationRecipient,
    subject: string,
    body: string,
    actor: string,
  ): Promise<Notification> {
    if (recipient.notificationChannel !== "sms") {
      return this.sendEmail(recipient.email, subject, body, actor);
    }
    const now = this.clock.now().toISOString();
    let notification: Notification = {
      id: this.ids.next(),
      channel: "sms",
      recipient: recipient.phone,
      subject,
      body,
      status: "pending",
      fallbackEmail: recipient.email,
      createdAt: now,
      updatedAt: now,
    };
    await this.changes.commit([{ entityType: "notification", entity: notification }], actor);
    try {
      const { messageId } = await this.sms.send({ to: recipient.phone, text: toSmsText(subject, body) });
      // The report may already have arrived; keep whatever it recorded.
      const current = (await this.notifications.findById(notification.id)) ?? notification;
      notification = { ...current, providerMessageId: messageId, updatedAt: this.clock.now().toISOString() };
      await this.changes.commit([{ entityType: "notification", entity: notification }], actor);
      return notification;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "SMS submission failed";
      return this.failSms(notification, recipient.email, reason, actor);
    }
  }

  async handleDeliveryReport(report: DeliveryReport): Promise<Notification> {
    const found = await this.notifications.findByProviderMessageId(report.messageId);
    if (!found) throw new NotFoundError(`Message ${report.messageId} not found`);
    if (found.status !== "pending") return found; // duplicate or late report
    if (report.status === "delivered") {
      const delivered: Notification = { ...found, status: "delivered", updatedAt: this.clock.now().toISOString() };
      await this.changes.commit([{ entityType: "notification", entity: delivered }], SYSTEM_ACTOR);
      return delivered;
    }
    return this.failSms(found, found.fallbackEmail ?? "", report.reason ?? "Delivery failed", SYSTEM_ACTOR);
  }

  async get(id: string): Promise<Notification> {
    const n = await this.notifications.findById(id);
    if (!n) throw new NotFoundError(`Notification ${id} not found`);
    return n;
  }

  async list(status?: string): Promise<Notification[]> {
    const all = await this.notifications.findAll();
    if (status === undefined) return all;
    const valid: NotificationStatus[] = ["pending", "sent", "delivered", "failed"];
    if (!valid.includes(status as NotificationStatus)) throw new ValidationError("status is invalid");
    return all.filter((n) => n.status === status);
  }

  private async failSms(sms: Notification, email: string, reason: string, actor: string): Promise<Notification> {
    const fallback = await this.sendEmail(sms.fallbackEmail ?? email, sms.subject, sms.body, actor, sms.id);
    const failed: Notification = {
      ...sms,
      status: "failed",
      failureReason: reason,
      fallbackId: fallback.id,
      updatedAt: this.clock.now().toISOString(),
    };
    await this.changes.commit([{ entityType: "notification", entity: failed }], actor);
    return failed;
  }

  private async sendEmail(
    to: string,
    subject: string,
    body: string,
    actor: string,
    fallbackForId?: string,
  ): Promise<Notification> {
    const now = this.clock.now().toISOString();
    const notification: Notification = {
      id: this.ids.next(),
      channel: "email",
      recipient: to,
      subject,
      body,
      status: "sent",
      ...(fallbackForId ? { fallbackForId } : {}),
      createdAt: now,
      updatedAt: now,
    };
    await this.mail.send({ to, subject, body });
    await this.changes.commit([{ entityType: "notification", entity: notification }], actor);
    return notification;
  }
}
