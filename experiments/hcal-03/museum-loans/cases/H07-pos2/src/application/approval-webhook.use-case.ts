import type { Request } from 'express';
import { ApproveLoanPort } from './ports/in/approve-loan.port';

export class ApprovalWebhookUseCase {
  constructor(private readonly approveLoan: ApproveLoanPort) {}

  async handle(req: Request): Promise<void> {
    const body = req.body as { loanId: string };
    await this.approveLoan.execute(body.loanId);
  }
}
