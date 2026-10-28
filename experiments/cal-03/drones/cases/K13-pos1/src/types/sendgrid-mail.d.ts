declare module '@sendgrid/mail' {
  export interface MailDataRequired {
    to: string;
    from: string;
    subject: string;
    text: string;
  }
}
