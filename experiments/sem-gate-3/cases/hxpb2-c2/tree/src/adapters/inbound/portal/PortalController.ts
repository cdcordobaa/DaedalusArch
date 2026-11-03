import { BureauError } from '../../../domain/errors/BureauError';
import type { ClientPortal } from '../../../application/ports/in/ClientPortal';

export interface PortalAnswer {
  readonly status: number;
  readonly data: Record<string, unknown>;
}

type Action = () => Promise<object>;

/** The client portal pages and the staff job cards. */
export class PortalController {
  constructor(private readonly portal: ClientPortal) {}

  order(form: Record<string, unknown>): Promise<PortalAnswer> {
    return this.answer(() => this.portal.placeOrder({
      orderNo: String(form.orderNo ?? ''),
      clientId: String(form.clientId ?? ''),
      sourceLang: String(form.sourceLang ?? ''),
      targetLang: String(form.targetLang ?? ''),
      words: Number(form.words),
      speed: String(form.speed ?? 'standard'),
    }));
  }

  post(orderNo: string): Promise<PortalAnswer> {
    return this.answer(() => this.portal.postToMarket(orderNo));
  }

  progress(orderNo: string): Promise<PortalAnswer> {
    return this.answer(() => this.portal.progress(orderNo));
  }

  invoice(orderNo: string): Promise<PortalAnswer> {
    return this.answer(() => this.portal.invoice(orderNo));
  }

  card(orderNo: string): Promise<PortalAnswer> {
    return this.answer(async () => ({ line: await this.portal.jobCard(orderNo) }));
  }

  private async answer(action: Action): Promise<PortalAnswer> {
    try {
      return { status: 200, data: { ...(await action()) } };
    } catch (e) {
      if (!(e instanceof BureauError)) throw e;
      return { status: 400, data: { error: e.message } };
    }
  }
}
