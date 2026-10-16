import { Inject, Service } from 'typedi';
import { Repository } from 'typeorm';
import { InjectRepository } from 'typeorm-typedi-extensions';
import { TranslationJob } from '../../domain/translation-job';
import { NotFoundError, ValidationError } from '../errors';
import { NOTIFICATIONS, NotificationsPort } from '../ports/notifications.port';
import { JobView, toJobView } from '../views';

@Service()
export class DeliverTranslationUseCase {
  constructor(
    @InjectRepository(TranslationJob) private readonly jobs: Repository<TranslationJob>,
    @Inject(NOTIFICATIONS) private readonly notifications: NotificationsPort,
  ) {}

  async execute(jobId: string, translatorId: string, fileUrl: string): Promise<JobView> {
    if (!fileUrl.startsWith('https://')) {
      throw new ValidationError('Deliveries are uploaded to the secure file store (an https URL)');
    }
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (job === null) {
      throw new NotFoundError(`Job ${jobId} not found`);
    }
    job.deliver(translatorId, fileUrl);
    const saved = await this.jobs.save(job);
    await this.notifications.deliveryReady(job.clientId, job.id);
    return toJobView(saved);
  }
}
