import { Inject, Service } from 'typedi';
import { Repository } from 'typeorm';
import { InjectRepository } from 'typeorm-typedi-extensions';
import { Review } from '../../domain/review';
import { TranslationJob } from '../../domain/translation-job';
import { ReviewCommand } from '../commands';
import { NotFoundError, ValidationError } from '../errors';
import { IDS, IdGeneratorPort } from '../ports/id-generator.port';
import { JobView, toJobView } from '../views';

/** Second-pair-of-eyes review; a pass approves the job, a fail sends it back to the translator. */
@Service()
export class ReviewDeliveryUseCase {
  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(TranslationJob) private readonly jobs: Repository<TranslationJob>,
    @Inject(IDS) private readonly ids: IdGeneratorPort,
  ) {}

  async execute(jobId: string, review: ReviewCommand): Promise<JobView> {
    if (!Number.isInteger(review.score) || review.score < 1 || review.score > 5) {
      throw new ValidationError('Review scores are whole numbers from 1 to 5');
    }
    if (review.score < Review.PASS_SCORE && review.comments.trim().length === 0) {
      throw new ValidationError('A failing review needs comments for the translator');
    }
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (job === null) {
      throw new NotFoundError(`Job ${jobId} not found`);
    }
    const saved = await this.reviews.save(new Review(this.ids.next(), jobId, review.reviewerId, review.score, review.comments.trim()));
    if (saved.passes()) {
      job.approve();
    } else if (job.translatorId !== null) {
      job.status = 'assigned';
    }
    return toJobView(await this.jobs.save(job));
  }
}
