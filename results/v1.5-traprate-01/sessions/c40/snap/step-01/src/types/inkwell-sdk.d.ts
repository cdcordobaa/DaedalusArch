// Typings of the Inkwell e-signature SDK (inkwell-sdk 5.1), as shipped by the vendor.
declare module 'inkwell-sdk' {
  export interface InkwellClientOptions {
    apiKey: string;
    /** Needed only to check callback signatures (client.webhooks). */
    webhookSecret?: string;
  }

  // ── Account ──
  export interface InkwellAccount {
    planCode: 'STARTER' | 'TEAM' | 'BUSINESS';
    envelopesRemaining: number;
    /** ISO 8601 with offset, e.g. 2026-11-30T23:59:59+00:00 */
    billingCycleEndsAt: string;
  }

  // ── Envelopes ──
  export interface InkwellRecipient {
    emailAddress: string;
    fullName: string;
    role: 'SIGNER' | 'CC';
    /** 1-based; recipients with a lower number act first. */
    routingOrder: number;
  }
  export interface InkwellDocument {
    fileName: string;
    documentBase64: string;
  }
  export interface InkwellEnvelopeDraft {
    emailSubject: string;
    documents: InkwellDocument[];
    recipients: InkwellRecipient[];
    expiresInDays: number;
  }
  export interface InkwellRecipientState extends InkwellRecipient {
    recipientStatus: 'SENT' | 'DELIVERED' | 'SIGNED' | 'DECLINED';
  }
  export interface InkwellEnvelope {
    envelopeId: string;
    envelopeStatus: 'SENT' | 'DELIVERED' | 'COMPLETED' | 'DECLINED' | 'EXPIRED' | 'VOIDED';
    /** ISO 8601 with offset, e.g. 2026-11-02T10:00:00+01:00 */
    sentDateTime: string;
    recipients: InkwellRecipientState[];
  }
  export interface InkwellReminderRequest {
    recipientEmails: string[];
  }
  export interface InkwellReminderReceipt {
    envelopeId: string;
    remindedCount: number;
    remindedDateTime: string;
  }

  // ── Errors ──
  export type InkwellErrorCode = 'INVALID_RECIPIENT' | 'RATE_LIMITED' | 'ENVELOPE_NOT_FOUND' | 'UNAUTHORIZED' | 'SERVICE_UNAVAILABLE';
  export class InkwellError extends Error {
    readonly errorCode: InkwellErrorCode;
    /** Set for INVALID_RECIPIENT. */
    readonly recipientEmail?: string;
  }
  /** Thrown by client.webhooks when a callback's Inkwell-Signature header does not match its body. */
  export class InkwellSignatureError extends Error {}

  // ── Webhooks (callbacks Inkwell POSTs to your endpoint, signed in the Inkwell-Signature header) ──
  export interface InkwellEventBase {
    eventId: string;
    envelopeId: string;
    occurredAt: string;
  }
  export interface InkwellRecipientDeclinedEvent extends InkwellEventBase {
    eventType: 'recipient.declined';
    recipient: { emailAddress: string; declineReason: string };
  }
  export interface InkwellRecipientViewedEvent extends InkwellEventBase {
    eventType: 'recipient.viewed';
    recipient: { emailAddress: string };
  }
  export interface InkwellEnvelopeExpiredEvent extends InkwellEventBase {
    eventType: 'envelope.expired';
  }
  export interface InkwellEnvelopeCompletedEvent extends InkwellEventBase {
    eventType: 'envelope.completed';
  }
  export type InkwellWebhookEvent = InkwellRecipientDeclinedEvent | InkwellRecipientViewedEvent | InkwellEnvelopeExpiredEvent | InkwellEnvelopeCompletedEvent;
  /** Callbacks for dispatch(); an event without a handler is acknowledged and dropped. */
  export interface InkwellWebhookHandlers {
    onRecipientDeclined?(event: InkwellRecipientDeclinedEvent): Promise<void>;
    onRecipientViewed?(event: InkwellRecipientViewedEvent): Promise<void>;
    onEnvelopeExpired?(event: InkwellEnvelopeExpiredEvent): Promise<void>;
    onEnvelopeCompleted?(event: InkwellEnvelopeCompletedEvent): Promise<void>;
  }
  export class InkwellWebhooks {
    /** Checks the Inkwell-Signature header against the raw body; throws InkwellSignatureError when it does not match. */
    parse(rawBody: string, signatureHeader: string): InkwellWebhookEvent;
    /** parse(), then calls the matching handler. */
    dispatch(rawBody: string, signatureHeader: string, handlers: InkwellWebhookHandlers): Promise<void>;
  }

  export class InkwellClient {
    constructor(options: InkwellClientOptions);
    readonly webhooks: InkwellWebhooks;
    account(): Promise<InkwellAccount>;
    createEnvelope(draft: InkwellEnvelopeDraft): Promise<InkwellEnvelope>;
    getEnvelope(envelopeId: string): Promise<InkwellEnvelope>;
    sendReminder(envelopeId: string, request: InkwellReminderRequest): Promise<InkwellReminderReceipt>;
  }
}
