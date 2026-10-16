import { ValidationError } from "./errors.js";

export type NotificationChannel = "email" | "sms";

/** pending: handed to the SMS provider, awaiting its report. sent: e-mail handed to the mail port. */
export type NotificationStatus = "pending" | "sent" | "delivered" | "failed";

export const SMS_MAX_LENGTH = 160;

export interface Notification {
  id: string;
  channel: NotificationChannel;
  /** E-mail address or phone number, depending on channel. */
  recipient: string;
  subject: string;
  body: string;
  status: NotificationStatus;
  /** Message id assigned by the SMS provider. */
  providerMessageId?: string;
  /** E-mail address used if this SMS fails. */
  fallbackEmail?: string;
  /** Set on an e-mail sent because the SMS notification with this id failed. */
  fallbackForId?: string;
  /** Set on an SMS notification once its e-mail fallback has been sent. */
  fallbackId?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export function parseChannel(value: unknown): NotificationChannel {
  if (value === undefined || value === null) return "email";
  if (value === "email" || value === "sms") return value;
  throw new ValidationError("notificationChannel must be 'email' or 'sms'");
}

/** Fits a message into a single SMS. */
export function toSmsText(subject: string, body: string): string {
  const text = body.trim() || subject;
  if (text.length <= SMS_MAX_LENGTH) return text;
  return `${text.slice(0, SMS_MAX_LENGTH - 3)}...`;
}
