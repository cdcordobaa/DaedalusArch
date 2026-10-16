import { ValidationError } from "./errors.js";

export type NotificationChannel = "email" | "sms";

export type DeliveryStatus = "pending" | "sent" | "delivered" | "failed";

export const SMS_MAX_LENGTH = 160;

export interface Notification {
  readonly id: string;
  readonly channel: NotificationChannel;
  readonly recipientName: string;
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  readonly status: DeliveryStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly providerMessageId?: string;
  readonly failureReason?: string;
  /** E-mail address used if an SMS delivery fails. */
  readonly fallbackEmail?: string;
  /** Set on an e-mail that replaces a failed SMS: the id of that SMS notification. */
  readonly fallbackForId?: string;
  /** Set on a failed SMS once its e-mail replacement has been sent. */
  readonly fallbackId?: string;
}

export function parseChannel(v: unknown, field: string): NotificationChannel {
  if (v === undefined || v === null) return "email";
  if (v !== "email" && v !== "sms") {
    throw new ValidationError(`${field} must be "email" or "sms"`);
  }
  return v;
}

export function smsText(subject: string, body: string): string {
  const full = body.trim() === "" ? subject : body;
  if (full.length <= SMS_MAX_LENGTH) return full;
  return `${full.slice(0, SMS_MAX_LENGTH - 3).trimEnd()}...`;
}

export type DeliveryReport = "delivered" | "failed";

export function parseDeliveryReport(input: unknown): {
  messageId: string;
  status: DeliveryReport;
  reason?: string;
} {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new ValidationError("delivery report is required");
  }
  const r = input as Record<string, unknown>;
  const rawId = r.messageId ?? r.message_id ?? r.id;
  if (typeof rawId !== "string" || rawId.trim() === "") {
    throw new ValidationError("messageId is required");
  }
  const rawStatus = typeof r.status === "string" ? r.status.trim().toLowerCase() : "";
  let status: DeliveryReport;
  if (rawStatus === "delivered") status = "delivered";
  else if (["failed", "undelivered", "rejected", "error", "expired"].includes(rawStatus)) {
    status = "failed";
  } else {
    throw new ValidationError("status must be delivered or failed");
  }
  const reason = [r.reason, r.error].find((x) => typeof x === "string") as string | undefined;
  return reason === undefined
    ? { messageId: rawId.trim(), status }
    : { messageId: rawId.trim(), status, reason };
}

export function applyDeliveryReport(
  n: Notification,
  status: DeliveryReport,
  reason: string | undefined,
  now: Date,
): Notification {
  const base = { ...n, status, updatedAt: now.toISOString() };
  return reason === undefined ? base : { ...base, failureReason: reason };
}
