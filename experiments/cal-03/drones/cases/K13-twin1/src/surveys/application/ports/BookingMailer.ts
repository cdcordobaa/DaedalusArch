export interface BookingMessage {
  to: string;
  subject: string;
  body: string;
}

export interface BookingMailer {
  send(message: BookingMessage): void;
}
