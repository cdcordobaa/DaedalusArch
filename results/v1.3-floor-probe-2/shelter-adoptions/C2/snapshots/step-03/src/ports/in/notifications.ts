import { Notification, Recipient } from '../../domain/notification';

export interface Notifier {
  notify(to: Recipient, subject: string, body: string): Promise<Notification>;
}

export interface DeliveryReports {
  reportDelivery(providerMessageId: string, delivered: boolean): Notification | undefined;
  listNotifications(): Notification[];
}
