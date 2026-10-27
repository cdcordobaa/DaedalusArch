import { InkwellClient } from 'inkwell-sdk';
import { AgreementsController } from '../adapters/inbound/http/AgreementsController';
import { InkwellCallbackController } from '../adapters/inbound/http/InkwellCallbackController';
import { InkwellAllowanceAdapter } from '../adapters/outbound/inkwell/InkwellAllowanceAdapter';
import { InkwellSignatureAdapter } from '../adapters/outbound/inkwell/InkwellSignatureAdapter';
import { InMemoryAgreementStore } from '../adapters/outbound/memory/InMemoryAgreementStore';
import type { DraftRequest } from '../application/ports/in/ManageAgreements';
import { AgreementService } from '../application/services/AgreementService';
import { AllowanceService } from '../application/services/AllowanceService';
import { ReminderService } from '../application/services/ReminderService';
import { SendForSignatureService } from '../application/services/SendForSignatureService';
import { SigningOutcomeService } from '../application/services/SigningOutcomeService';

/** Composition root. The Inkwell key comes from INKWELL_API_KEY, the callback secret from INKWELL_WEBHOOK_SECRET. */
export function createApp() {
  const inkwell = new InkwellClient({ apiKey: process.env.INKWELL_API_KEY ?? '', webhookSecret: process.env.INKWELL_WEBHOOK_SECRET ?? '' });
  const store = new InMemoryAgreementStore();
  const allowanceSource = new InkwellAllowanceAdapter(inkwell);
  const signatures = new InkwellSignatureAdapter(inkwell);
  const agreements = new AgreementService(store);
  const allowance = new AllowanceService(allowanceSource);
  const sending = new SendForSignatureService(store, allowanceSource, signatures);
  const reminders = new ReminderService(store, signatures);
  const callbacks = new InkwellCallbackController(inkwell.webhooks, new SigningOutcomeService(store));
  const http = new AgreementsController(agreements, allowance);
  return {
    draft: (request: DraftRequest) => agreements.draft(request),
    view: (id: string) => agreements.view(id),
    allowance: () => allowance.allowance(),
    send: (agreementId: string) => sending.send(agreementId),
    inkwellEvent: (rawBody: string, signatureHeader: string) => callbacks.post(rawBody, signatureHeader),
    sendReminders: (now: Date) => reminders.sendReminders(now),
    http,
  };
}
