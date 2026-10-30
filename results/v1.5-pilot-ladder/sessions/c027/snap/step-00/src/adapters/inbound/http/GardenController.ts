import type { JoinWaitingList, OfferPlot } from '../../../application/ports/in/WaitingList';

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/** The committee's screens: the waiting list and plot offers. */
export class GardenController {
  constructor(
    private readonly list: JoinWaitingList,
    private readonly offers: OfferPlot,
  ) {}

  postJoin(body: Record<string, unknown>): Promise<HttpResponse> {
    return this.run(() => this.list.join(String(body.name ?? ''), String(body.email ?? '')));
  }

  getList(): Promise<HttpResponse> {
    return this.run(() => this.list.list());
  }

  postOffer(plotId: string): Promise<HttpResponse> {
    return this.run(() => this.offers.offer(plotId));
  }

  private async run(fn: () => Promise<unknown>): Promise<HttpResponse> {
    try {
      return { status: 200, body: await fn() };
    } catch (e) {
      return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }
}
