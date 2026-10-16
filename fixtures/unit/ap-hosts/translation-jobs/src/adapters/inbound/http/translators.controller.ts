import { Request, Response } from 'express';
import { Service } from 'typedi';
import { JobQueriesService } from '../../../application/queries/job-queries.service';
import { RegisterTranslatorUseCase } from '../../../application/use-cases/register-translator.use-case';
import { fieldsOf, num, str, strings } from './body';

@Service()
export class TranslatorsController {
  constructor(
    private readonly registerTranslator: RegisterTranslatorUseCase,
    private readonly queries: JobQueriesService,
  ) {}

  async register(req: Request, res: Response): Promise<void> {
    const f = fieldsOf(req.body);
    const profile = { fullName: str(f, 'fullName'), email: str(f, 'email'), pairs: strings(f, 'pairs'), centsPerWord: num(f, 'centsPerWord') };
    res.status(201).json(await this.registerTranslator.execute(profile.fullName, profile.email, profile.pairs, profile.centsPerWord));
  }

  async forPair(req: Request, res: Response): Promise<void> {
    res.json(await this.queries.translatorsFor(req.query.pair ?? ''));
  }
}
