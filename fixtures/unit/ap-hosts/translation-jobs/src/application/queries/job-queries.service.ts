import { Inject, Service } from 'typedi';
import { Repository } from 'typeorm';
import { InjectRepository } from 'typeorm-typedi-extensions';
import { TranslationJob } from '../../domain/translation-job';
import { Translator } from '../../domain/translator';
import { NotFoundError, ValidationError } from '../errors';
import { CLOCK, ClockPort } from '../ports/clock.port';
import { JobView, toJobView, toTranslatorView, TranslatorView } from '../views';

/** Read side for the project managers' dashboard. */
@Service()
export class JobQueriesService {
  constructor(
    @InjectRepository(TranslationJob) private readonly jobs: Repository<TranslationJob>,
    @InjectRepository(Translator) private readonly translators: Repository<Translator>,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async job(jobId: string): Promise<JobView> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (job === null) {
      throw new NotFoundError(`Job ${jobId} not found`);
    }
    return toJobView(job);
  }

  async forClient(clientId: string): Promise<JobView[]> {
    return (await this.jobs.find({ where: { clientId }, order: { dueAt: 'ASC' } })).map(toJobView);
  }

  async late(): Promise<JobView[]> {
    const now = this.clock.now();
    return (await this.jobs.find({ order: { dueAt: 'ASC' } })).filter((j) => j.isLate(now)).map(toJobView);
  }

  async translatorsFor(pair: string): Promise<TranslatorView[]> {
    if (!/^[a-z]{2}>[a-z]{2}$/.test(pair)) {
      throw new ValidationError('Language pairs look like en>de');
    }
    return (await this.translators.find({ where: { active: true } })).filter((t) => t.pairs.includes(pair)).map(toTranslatorView);
  }
}
