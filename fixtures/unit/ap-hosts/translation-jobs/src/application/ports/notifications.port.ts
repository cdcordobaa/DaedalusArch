import { Token } from 'typedi';

export interface NotificationsPort {
  jobAssigned(translatorEmail: string, jobId: string, dueAt: Date): Promise<void>;
  deliveryReady(clientId: string, jobId: string): Promise<void>;
}

export const NOTIFICATIONS = new Token<NotificationsPort>('notifications');
