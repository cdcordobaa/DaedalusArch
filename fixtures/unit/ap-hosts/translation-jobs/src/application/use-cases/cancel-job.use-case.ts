import { Inject, Service } from 'typedi';
import { Repository } from 'typeorm';
import { InjectRepository } from 'typeorm-typedi-extensions';
import { TranslationJob } from '../../domain/translation-job';
import { NotFoundError, ValidationError } from '../errors';
import { PAYMENTS, PaymentsPort } from '../ports/payments.port';
import { JobView, toJobView } from '../views';

/** Client cancellation; work not yet assigned is refunded in full. */
@Service()
export class CancelJobUseCase {
  constructor(
    @InjectRepository(TranslationJob) private readonly jobs: Repository<TranslationJob>,
    @Inject(PAYMENTS) private readonly payments: PaymentsPort,
  ) {}

  async execute(jobId: string, reason: string, paymentReference: string, refundCents: number): Promise<JobView> {
    if (reason.trim().length < 10) {
      throw new ValidationError('Please describe why the job is cancelled (10 characters or more)');
    }
    if (refundCents < 0) {
      throw new ValidationError('A refund cannot be negative');
    }
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (job === null) {
      throw new NotFoundError(`Job ${jobId} not found`);
    }
    const unassigned = job.status === 'open';
    job.cancel();
    const saved = await this.jobs.save(job);
    if (unassigned && refundCents > 0) {
      await this.payments.refund(paymentReference, refundCents);
    }
    return toJobView(saved);
  }
}
