// Typings of the Textwave SMS SDK (textwave-sdk 7.1), as shipped by the vendor.
declare module 'textwave-sdk' {
  export interface TextwaveOutboundMessage {
    to: string;
    from: string;
    body: string;
    validityMinutes?: number;
  }
  export interface TextwaveSubmitResponse {
    messageSid: string;
    segments: number;
  }
  export type TextwaveDeliveryState = 'ACCEPTED' | 'DELIVERED' | 'UNDELIVERED' | 'EXPIRED';
  export interface TextwaveDeliveryReport {
    messageSid: string;
    deliveryState: TextwaveDeliveryState;
    handsetErrorCode?: string;
    finalizedAt?: string;
  }
  export class TextwaveThrottledError extends Error {
    readonly retryAfterSeconds: number;
  }
  export class TextwaveRecipientBlockedError extends Error {
    readonly blockReason: 'OPTED_OUT' | 'CARRIER_BLOCKED';
  }
  export class TextwaveUnavailableError extends Error {}
  export class TextwaveClient {
    constructor(options: { apiKey: string });
    submit(message: TextwaveOutboundMessage): Promise<TextwaveSubmitResponse>;
    deliveryReport(messageSid: string): Promise<TextwaveDeliveryReport>;
  }
}
