import { Request, Response } from 'express';
import { DayPassesService } from '../../services/day-passes.service';
import { InvoicingService } from '../../services/invoicing.service';
import { fieldsOf, text } from '../parse';
import { sellDayPassRequest } from '../requests';

export class BillingController {
  constructor(
    private readonly dayPasses: DayPassesService,
    private readonly invoicing: InvoicingService,
  ) {}

  async sellDayPass(req: Request, res: Response): Promise<void> {
    const input = sellDayPassRequest(req.body);
    res.status(201).json(await this.dayPasses.sell(input.email, input.date, input.quantity));
  }

  async issueInvoice(req: Request, res: Response): Promise<void> {
    const period = text(fieldsOf(req.body), 'period');
    res.status(201).json(await this.invoicing.issueMonthly(req.params.membershipId, period));
  }

  async markPaid(req: Request, res: Response): Promise<void> {
    const body = fieldsOf(req.body);
    res.json(await this.invoicing.markPaid(req.params.invoiceId, text(body, 'reference')));
  }

  async invoicesOf(req: Request, res: Response): Promise<void> {
    res.json(await this.invoicing.forMember(req.params.memberId));
  }
}
