import { InkwellClient, InkwellSignatureError } from 'inkwell-sdk';
import { AgreementsController } from '../adapters/inbound/http/AgreementsController';
import { InkwellEnvelopeAdapter } from '../adapters/outbound/inkwell/InkwellEnvelopeAdapter';
import { InkwellAllowanceAdapter } from '../adapters/outbound/inkwell/InkwellAllowanceAdapter';
import { InMemoryAgreementStore } from '../adapters/outbound/memory/InMemoryAgreementStore';
import type { DraftRequest } from '../application/ports/in/ManageAgreements';
import { AgreementService } from '../application/services/AgreementService';
import { AllowanceService } from '../application/services/AllowanceService';
import { SigningService } from '../application/services/SigningService';

/** Composition root. The Inkwell key comes from INKWELL_API_KEY. */
export function createApp() {
  const inkwell = new InkwellClient({ apiKey: process.env.INKWELL_API_KEY ?? '', webhookSecret: process.env.INKWELL_WEBHOOK_SECRET });
  const store = new InMemoryAgreementStore();
  const agreements = new AgreementService(store);
  const allowance = new AllowanceService(new InkwellAllowanceAdapter(inkwell));
  const signing = new SigningService(store, new InkwellAllowanceAdapter(inkwell), new InkwellEnvelopeAdapter(inkwell));
  const http = new AgreementsController(agreements, allowance);
  return {
    draft: (request: DraftRequest) => agreements.draft(request),
    view: (id: string) => agreements.view(id),
    allowance: () => allowance.allowance(),
    send: (id: string) => signing.send(id),
    inkwellEvent: async (rawBody: string, signatureHeader: string) => {
      try {
        await inkwell.webhooks.dispatch(rawBody, signatureHeader, signing);
        return { status: 200 };
      } catch (e) {
        if (e instanceof InkwellSignatureError) return { status: 401 };
        throw e;
      }
    },
    sendReminders: (now: Date) => signing.sendReminders(now),
    http,
  };
}
