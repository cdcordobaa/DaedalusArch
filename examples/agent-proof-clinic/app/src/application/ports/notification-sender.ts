export interface NotificationRecipient {
  name: string;
  email?: string;
  phone?: string;
}

export interface Notification {
  recipient: NotificationRecipient;
  subject: string;
  body: string;
}

/** Delivers a message to a patient; the adapter picks the channel (email, SMS, ...). */
export interface NotificationSender {
  send(notification: Notification): Promise<void>;
}
