import type { Notification, NotificationSender } from "../../application/ports/notification-sender.js";

/** Development sender: logs what would be emailed (preferred) or texted. */
export class ConsoleNotificationSender implements NotificationSender {
  async send(notification: Notification): Promise<void> {
    const { recipient, subject, body } = notification;
    const channel = recipient.email ? `email to ${recipient.email}` : `SMS to ${recipient.phone}`;
    console.log(`[notification] ${channel} | ${subject} | ${body}`);
  }
}
