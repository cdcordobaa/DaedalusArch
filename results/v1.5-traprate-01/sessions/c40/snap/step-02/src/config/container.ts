import { InkwellClient, InkwellSignatureError } from 'inkwell-sdk';
import { AgreementsController } from '../adapters/inbound/http/AgreementsController';
import { InkwellAllowanceAdapter } from '../adapters/outbound/inkwell/InkwellAllowanceAdapter';
import { InkwellEnvelopeAdapter } from '../adapters/outbound/inkwell/InkwellEnvelopeAdapter';
import { InMemoryAgreementStore } from '../adapters/outbound/memory/InMemoryAgreementStore';
import type { DraftRequest } from '../application/ports/in/ManageAgreements';
import { AgreementService } from '../application/services/AgreementService';
import { AllowanceService } from '../application/services/AllowanceService';

/** Composition root. The Inkwell key comes from INKWELL_API_KEY, the callback secret from INKWELL_WEBHOOK_SECRET. */
export function createApp() {
  const inkwell = new InkwellClient({ apiKey: process.env.INKWELL_API_KEY ?? '', webhookSecret: process.env.INKWELL_WEBHOOK_SECRET ?? '' });
  const store = new InMemoryAgreementStore();
  const allowanceSource = new InkwellAllowanceAdapter(inkwell);
  const agreements = new AgreementService(store, allowanceSource, new InkwellEnvelopeAdapter(inkwell));
  const allowance = new AllowanceService(allowanceSource);
  const http = new AgreementsController(agreements, allowance);
  const inkwellEvent = async (rawBody: string, signatureHeader: string): Promise<{ status: number }> => {
    try {
      await inkwell.webhooks.dispatch(rawBody, signatureHeader, {
        onRecipientDeclined: (e) => agreements.tenantDeclined(e.envelopeId, e.recipient.emailAddress, e.recipient.declineReason),
        onEnvelopeExpired: (e) => agreements.signingExpired(e.envelopeId),
        onEnvelopeCompleted: (e) => agreements.allSigned(e.envelopeId),
      });
      return { status: 200 };
    } catch (e) {
      if (e instanceof InkwellSignatureError) return { status: 401 };
      throw e;
    }
  };
  return {
    draft: (request: DraftRequest) => agreements.draft(request),
    view: (id: string) => agreements.view(id),
    send: (agreementId: string) => agreements.send(agreementId),
    allowance: () => allowance.allowance(),
    inkwellEvent,
    http,
  };
}
