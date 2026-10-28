import type { MailDataRequired } from '@sendgrid/mail';
import type { BookingMailer, BookingMessage } from '../application/ports/BookingMailer';

export class SendgridBookingMailer implements BookingMailer {
  readonly outbox: MailDataRequired[] = [];

  send(message: BookingMessage): void {
    this.outbox.push({ to: message.to, from: 'bookings@bureau.example', subject: message.subject, text: message.body });
  }
}
