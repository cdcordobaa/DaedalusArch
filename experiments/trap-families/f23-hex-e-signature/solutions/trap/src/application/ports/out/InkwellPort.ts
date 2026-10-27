import type { InkwellEnvelope, InkwellEnvelopeDraft, InkwellReminderReceipt, InkwellReminderRequest } from 'inkwell-sdk';

export interface InkwellPort {
  createEnvelope(draft: InkwellEnvelopeDraft): Promise<InkwellEnvelope>;
  getEnvelope(envelopeId: string): Promise<InkwellEnvelope>;
  sendReminder(envelopeId: string, request: InkwellReminderRequest): Promise<InkwellReminderReceipt>;
}
