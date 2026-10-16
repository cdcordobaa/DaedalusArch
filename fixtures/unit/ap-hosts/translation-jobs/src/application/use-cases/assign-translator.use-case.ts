import { Inject, Service } from 'typedi';
import { Repository } from 'typeorm';
import { InjectRepository } from 'typeorm-typedi-extensions';
import { LanguagePair } from '../../domain/language';
import { TranslationJob } from '../../domain/translation-job';
import { Translator } from '../../domain/translator';
import { NotFoundError } from '../errors';
import { NOTIFICATIONS, NotificationsPort } from '../ports/notifications.port';
import { JobView, toJobView } from '../views';

@Service()
export class AssignTranslatorUseCase {
  constructor(
    @InjectRepository(TranslationJob) private readonly jobs: Repository<TranslationJob>,
    @InjectRepository(Translator) private readonly translators: Repository<Translator>,
    @Inject(NOTIFICATIONS) private readonly notifications: NotificationsPort,
  ) {}

  async execute(jobId: string, translatorId: string): Promise<JobView> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    const translator = await this.translators.findOne({ where: { id: translatorId } });
    if (job === null || translator === null) {
      throw new NotFoundError('Unknown job or translator');
    }
    translator.ensureQualifiedFor(LanguagePair.parse(job.pair));
    job.assign(translator.id);
    const saved = await this.jobs.save(job);
    await this.notifications.jobAssigned(translator.email, job.id, job.dueAt);
    return toJobView(saved);
  }
}
