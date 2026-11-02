import type { HireBoats } from '../../../application/ports/in/HireBoats';
import type { QuoteLine } from '../../../application/ports/in/QuoteLine';
import type { CheckHirer } from '../../../application/ports/in/CheckHirer';

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/** The wharf office screens: hires, handovers and returns, quote lines and hirer checks. */
export class WharfController {
  constructor(
    private readonly hires: HireBoats,
    private readonly quotes: QuoteLine,
    private readonly hirers: CheckHirer,
  ) {}

  postHire(body: Record<string, unknown>): Promise<HttpResponse> {
    return this.run(() => this.hires.reserve({ hireId: String(body.hireId ?? ''), boatId: String(body.boatId ?? ''), from: String(body.from ?? ''), nights: Number(body.nights), hirerRef: String(body.hirerRef ?? ''), quoteRef: String(body.quoteRef ?? '') }));
  }

  postHandOver(hireId: string): Promise<HttpResponse> {
    return this.run(() => this.hires.handOver(hireId));
  }

  postReturn(hireId: string): Promise<HttpResponse> {
    return this.run(() => this.hires.bringBack(hireId));
  }

  getQuoteLine(quoteRef: string): Promise<HttpResponse> {
    return this.run(() => this.quotes.line(quoteRef));
  }

  getHirer(hirerRef: string): Promise<HttpResponse> {
    return this.run(() => this.hirers.check(hirerRef));
  }

  private async run(fn: () => Promise<unknown>): Promise<HttpResponse> {
    try {
      return { status: 200, body: await fn() };
    } catch (e) {
      return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }
}
