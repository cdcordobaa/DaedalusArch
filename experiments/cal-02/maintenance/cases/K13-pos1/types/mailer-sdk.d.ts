declare module 'mailer-sdk' {
  export interface MailMessage {
    to: string;
    subject: string;
    body: string;
  }
}
