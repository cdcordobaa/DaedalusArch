export type Channel = 'email' | 'sms';
export type DeliveryStatus = 'sent' | 'delivered' | 'failed' | 'fallback-email';

export interface Recipient { name: string; email: string; phone?: string; preferredChannel?: Channel }

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
}

export const SMS_MAX = 160;

export function smsText(subject: string, body: string): string {
  const t = `${subject}: ${body}`;
  return t.length <= SMS_MAX ? t : `${t.slice(0, SMS_MAX - 1)}…`;
}
