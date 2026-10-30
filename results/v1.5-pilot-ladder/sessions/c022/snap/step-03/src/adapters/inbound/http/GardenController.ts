import type { JoinWaitingList, OfferPlot } from '../../../application/ports/in/WaitingList';
import type { PublishNewsletter } from '../../../application/services/plots/NewsletterService';

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/** The committee's screens: the waiting list and plot offers. */
export class GardenController {
  constructor(
    private readonly list: JoinWaitingList,
    private readonly offers: OfferPlot,
    private readonly newsletter: PublishNewsletter,
  ) {}

  postJoin(body: Record<string, unknown>): Promise<HttpResponse> {
    return this.run(() => this.list.join(String(body.name ?? ''), String(body.email ?? ''), body.member === true));
  }

  getList(): Promise<HttpResponse> {
    return this.run(() => this.list.list());
  }

  postOffer(plotId: string): Promise<HttpResponse> {
    return this.run(() => this.offers.offer(plotId));
  }

  postRemind(plotId: string): Promise<HttpResponse> {
    return this.run(() => this.offers.remind(plotId));
  }

  postNewsletter(subject: string, text: string): Promise<HttpResponse> {
    return this.run(async () => ({ published: await this.newsletter.publish(subject, text) }));
  }

  private async run(fn: () => Promise<unknown>): Promise<HttpResponse> {
    try {
      return { status: 200, body: await fn() };
    } catch (e) {
      return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }
}
