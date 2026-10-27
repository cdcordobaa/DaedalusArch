import type { MailMessage } from 'mailer-sdk';

export interface ContractorMailer {
  send(message: MailMessage): void;
}
