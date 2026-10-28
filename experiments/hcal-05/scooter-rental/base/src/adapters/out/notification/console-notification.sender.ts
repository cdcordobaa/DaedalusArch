import { NotificationSenderPort } from '../../../application/ports/out/notification-sender.port';

export class ConsoleNotificationSender implements NotificationSenderPort {
  async send(riderId: string, message: string): Promise<void> { console.log(`[${riderId}] ${message}`); }
}
