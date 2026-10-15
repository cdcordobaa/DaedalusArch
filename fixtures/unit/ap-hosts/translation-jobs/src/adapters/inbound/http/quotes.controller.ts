import { Request, Response } from 'express';
import { Service } from 'typedi';
import { RequestQuoteCommand } from '../../../application/commands';
import { AcceptQuoteUseCase } from '../../../application/use-cases/accept-quote.use-case';
import { RequestQuoteUseCase } from '../../../application/use-cases/request-quote.use-case';
import { bool, fieldsOf, num, str } from './body';

@Service()
export class QuotesController {
  constructor(
    private readonly requestQuote: RequestQuoteUseCase,
    private readonly acceptQuote: AcceptQuoteUseCase,
  ) {}

  async request(req: Request, res: Response): Promise<void> {
    const f = fieldsOf(req.body);
    const command: RequestQuoteCommand = {
      clientId: str(f, 'clientId'),
      sourceLanguage: str(f, 'sourceLanguage'),
      targetLanguage: str(f, 'targetLanguage'),
      words: num(f, 'words'),
      dueAt: str(f, 'dueAt'),
      documentUrl: str(f, 'documentUrl'),
      certified: bool(f, 'certified'),
    };
    res.status(201).json(await this.requestQuote.execute(command));
  }

  async accept(req: Request, res: Response): Promise<void> {
    const body = fieldsOf(req.body);
    const order = { purchaseOrder: str(body, 'purchaseOrder') };
    res.status(201).json(await this.acceptQuote.execute(req.params.quoteId, order.purchaseOrder));
  }
}
