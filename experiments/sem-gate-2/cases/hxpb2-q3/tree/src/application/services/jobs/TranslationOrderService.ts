import type { TranslationOrder } from '../../../domain/model/TranslationOrder';
import { BureauError } from '../../../domain/errors/BureauError';
import { Pricing } from '../../../domain/services/Pricing';
import type { ClientPortal, Invoice, NewOrder, Progress, Quote } from '../../ports/in/ClientPortal';
import type { OrderBook } from '../../ports/out/records/OrderBook';
import type { JobPosting } from '../../ports/out/marketplace/JobPosting';
import type { JobLookup } from '../../ports/out/marketplace/JobLookup';

import { BUREAU_STAGE_OF, BureauStage } from '../../../domain/model/BureauStage';

const SHOWN: Record<BureauStage, string> = {
  [BureauStage.Offered]: 'FINDING_TRANSLATOR',
  [BureauStage.Assigned]: 'IN_TRANSLATION',
  [BureauStage.Drafting]: 'IN_TRANSLATION',
  [BureauStage.Proofing]: 'BEING_CHECKED',
  [BureauStage.Delivered]: 'READY_TO_DOWNLOAD',
  [BureauStage.Queried]: 'ON_HOLD',
};

export class TranslationOrderService implements ClientPortal {
  constructor(
    private readonly book: OrderBook,
    private readonly posting: JobPosting,
    private readonly lookup: JobLookup,
    private readonly pricing = new Pricing(),
  ) {}

  async placeOrder(n: NewOrder): Promise<Quote> {
    if ((await this.book.byNumber(n.orderNo)) !== null) throw new BureauError('order ' + n.orderNo + ' exists already');
    const [sourceLang, targetLang] = this.pricing.languages(n.sourceLang, n.targetLang);
    const speed = this.pricing.speed(n.speed);
    const order: TranslationOrder = { orderNo: n.orderNo, clientId: n.clientId, sourceLang, targetLang, words: n.words, speed, priceEuros: this.pricing.quote(n.words, speed) };
    await this.book.record(order);
    return { orderNo: order.orderNo, priceEuros: order.priceEuros };
  }

  async postToMarket(orderNo: string): Promise<{ orderNo: string; jobId: string }> {
    const order = await this.order(orderNo);
    if (order.jobId !== undefined) throw new BureauError('order ' + orderNo + ' is already posted');
    const jobId = await this.posting.post(order, 'Order ' + order.orderNo + ' for ' + order.clientId);
    await this.book.record({ ...order, jobId });
    return { orderNo, jobId };
  }

  async progress(orderNo: string): Promise<Progress> {
    const order = await this.order(orderNo);
    if (order.jobId === undefined) return { orderNo, stage: 'RECEIVED' };
    const stage = BUREAU_STAGE_OF[(await this.lookup.snapshot(order.jobId)).stateCode];
    return { orderNo, stage: stage === undefined ? 'ON_HOLD' : SHOWN[stage] };
  }

  async invoice(orderNo: string): Promise<Invoice> {
    const order = await this.order(orderNo);
    const stage = order.jobId === undefined ? undefined : BUREAU_STAGE_OF[(await this.lookup.snapshot(order.jobId)).stateCode];
    if (stage !== BureauStage.Delivered) throw new BureauError('The translation is not finished yet.');
    return { orderNo, amountEuros: order.priceEuros };
  }

  async jobCard(orderNo: string): Promise<string> {
    const order = await this.order(orderNo);
    if (order.jobId === undefined) return 'Not posted';
    const s = await this.lookup.snapshot(order.jobId);
    return s.jobId + ' ' + s.stateCode + ' by ' + (s.translator ?? 'nobody yet') + ' (' + s.updatedAt + ')';
  }

  private async order(orderNo: string): Promise<TranslationOrder> {
    const found = await this.book.byNumber(orderNo);
    if (found === null) throw new BureauError('no order ' + orderNo);
    return found;
  }
}
