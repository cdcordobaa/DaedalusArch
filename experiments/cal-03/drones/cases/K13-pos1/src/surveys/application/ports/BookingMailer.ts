import type { MailDataRequired } from '@sendgrid/mail';

export interface BookingMailer {
  send(message: MailDataRequired): void;
}
