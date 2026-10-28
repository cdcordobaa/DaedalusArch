import { InkwellClient } from 'inkwell-sdk';
import { AgreementsController } from '../adapters/inbound/http/AgreementsController';
import { InkwellAllowanceAdapter } from '../adapters/outbound/inkwell/InkwellAllowanceAdapter';
import { InkwellEnvelopeAdapter } from '../adapters/outbound/inkwell/InkwellEnvelopeAdapter';
import { InMemoryAgreementStore } from '../adapters/outbound/memory/InMemoryAgreementStore';
import type { DraftRequest } from '../application/ports/in/ManageAgreements';
import { AgreementService } from '../application/services/AgreementService';
import { AllowanceService } from '../application/services/AllowanceService';

/** Composition root. The Inkwell key comes from INKWELL_API_KEY. */
export function createApp() {
  const inkwell = new InkwellClient({ apiKey: process.env.INKWELL_API_KEY ?? '' });
  const store = new InMemoryAgreementStore();
  const allowanceSource = new InkwellAllowanceAdapter(inkwell);
  const agreements = new AgreementService(store, allowanceSource, new InkwellEnvelopeAdapter(inkwell));
  const allowance = new AllowanceService(allowanceSource);
  const http = new AgreementsController(agreements, allowance);
  return {
    draft: (request: DraftRequest) => agreements.draft(request),
    view: (id: string) => agreements.view(id),
    send: (agreementId: string) => agreements.send(agreementId),
    allowance: () => allowance.allowance(),
    http,
  };
}
