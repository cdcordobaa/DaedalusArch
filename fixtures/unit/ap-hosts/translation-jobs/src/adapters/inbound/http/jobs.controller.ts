import { Request, Response } from 'express';
import { Service } from 'typedi';
import { JobQueriesService } from '../../../application/queries/job-queries.service';
import { AssignTranslatorUseCase } from '../../../application/use-cases/assign-translator.use-case';
import { CancelJobUseCase } from '../../../application/use-cases/cancel-job.use-case';
import { DeliverTranslationUseCase } from '../../../application/use-cases/deliver-translation.use-case';
import { ReviewDeliveryUseCase } from '../../../application/use-cases/review-delivery.use-case';
import { fieldsOf, num, str } from './body';

@Service()
export class JobsController {
  constructor(
    private readonly assignTranslator: AssignTranslatorUseCase,
    private readonly deliverTranslation: DeliverTranslationUseCase,
    private readonly reviewDelivery: ReviewDeliveryUseCase,
    private readonly cancelJob: CancelJobUseCase,
    private readonly queries: JobQueriesService,
  ) {}

  async assign(req: Request, res: Response): Promise<void> {
    const body = fieldsOf(req.body);
    res.json(await this.assignTranslator.execute(req.params.jobId, str(body, 'translatorId')));
  }

  async deliver(req: Request, res: Response): Promise<void> {
    const delivery = { translatorId: str(fieldsOf(req.body), 'translatorId'), fileUrl: str(fieldsOf(req.body), 'fileUrl') };
    res.json(await this.deliverTranslation.execute(req.params.jobId, delivery.translatorId, delivery.fileUrl));
  }

  async review(req: Request, res: Response): Promise<void> {
    const f = fieldsOf(req.body);
    const review = { reviewerId: str(f, 'reviewerId'), score: num(f, 'score'), comments: str(f, 'comments') };
    res.json(await this.reviewDelivery.execute(req.params.jobId, review));
  }

  async cancel(req: Request, res: Response): Promise<void> {
    const f = fieldsOf(req.body);
    const cancellation = { reason: str(f, 'reason'), paymentReference: str(f, 'paymentReference'), refundCents: num(f, 'refundCents') };
    res.json(await this.cancelJob.execute(req.params.jobId, cancellation.reason, cancellation.paymentReference, cancellation.refundCents));
  }

  async findOne(req: Request, res: Response): Promise<void> {
    res.json(await this.queries.job(req.params.jobId));
  }

  async forClient(req: Request, res: Response): Promise<void> {
    res.json(await this.queries.forClient(req.params.clientId));
  }

  async late(_req: Request, res: Response): Promise<void> {
    res.json(await this.queries.late());
  }
}
