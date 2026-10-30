// Typings of the Postbird email SDK (postbird-sdk 9.0), as shipped by the vendor.
declare module 'postbird-sdk' {
  export interface PostbirdMessage {
    to: string;
    templateId: string;
    variables: Record<string, string>;
  }
  export interface PostbirdReceipt {
    messageId: string;
    state: 'queued' | 'sent' | 'rejected';
  }
  export class PostbirdError extends Error {}
  export class PostbirdClient {
    constructor(options: { apiKey: string });
    sendTemplate(message: PostbirdMessage): Promise<PostbirdReceipt>;
  }
}
