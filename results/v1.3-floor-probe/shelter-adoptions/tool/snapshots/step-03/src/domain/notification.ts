export type Channel = 'email' | 'sms';
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'fell-back-to-email';

export interface Recipient {
  name: string;
  email: string;
  phone?: string;
  preferredChannel?: Channel;
}

export interface Notification {
  id: string;
  recipient: Recipient;
  channel: Channel;
  subject: string;
  body: string;
  status: DeliveryStatus;
  providerMessageId?: string;
  createdAt: string;
  updatedAt: string;
  fallbackOf?: string;
}

export const SMS_MAX_LENGTH = 160;

export function smsText(subject: string, body: string): string {
  const text = `${subject}: ${body}`;
  return text.length <= SMS_MAX_LENGTH ? text : text.slice(0, SMS_MAX_LENGTH - 1) + '…';
}

export function chooseChannel(r: Recipient): Channel {
  return r.preferredChannel === 'sms' && r.phone ? 'sms' : 'email';
}
