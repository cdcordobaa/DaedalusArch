import { Inject, Service } from 'typedi';
import { Repository } from 'typeorm';
import { InjectRepository } from 'typeorm-typedi-extensions';
import { Deadline } from '../../domain/deadline';
import { Quote } from '../../domain/quote';
import { TranslationJob } from '../../domain/translation-job';
import { NotFoundError, PaymentDeclinedError, ValidationError } from '../errors';
import { CLOCK, ClockPort } from '../ports/clock.port';
import { PAYMENTS, PaymentsPort } from '../ports/payments.port';
import { JobView, toJobView } from '../views';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Turns an accepted, paid quote into an open job. */
@Service()
export class AcceptQuoteUseCase {
  constructor(
    @InjectRepository(Quote) private readonly quotes: Repository<Quote>,
    @InjectRepository(TranslationJob) private readonly jobs: Repository<TranslationJob>,
    @Inject(PAYMENTS) private readonly payments: PaymentsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(quoteId: string, purchaseOrder: string): Promise<JobView> {
    if (purchaseOrder.trim().length === 0) {
      throw new ValidationError('Business clients quote their purchase order number');
    }
    const quote = await this.quotes.findOne({ where: { id: quoteId } });
    if (quote === null) {
      throw new NotFoundError(`Quote ${quoteId} not found`);
    }
    const now = this.clock.now();
    quote.accept(now);
    const payment = await this.payments.authorise(quote.clientId, quote.totalCents, purchaseOrder.trim());
    if (!payment.authorised) {
      throw new PaymentDeclinedError(`Payment for quote ${quoteId} was declined`);
    }
    await this.quotes.save(quote);
    const days = Math.max(Math.ceil(quote.words / Deadline.WORDS_PER_DAY), quote.rush ? 1 : Deadline.RUSH_DAYS);
    const job = new TranslationJob(quote.id, quote.id, quote.clientId, quote.pair, quote.words, new Date(now.getTime() + days * DAY_MS), 'open', null, null);
    return toJobView(await this.jobs.save(job));
  }
}
