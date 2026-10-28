import { ApproveLoanPort } from './ports/in/approve-loan.port';

export interface ApprovalWebhookCommand {
  loanId: string;
}

export class ApprovalWebhookUseCase {
  constructor(private readonly approveLoan: ApproveLoanPort) {}

  async handle(command: ApprovalWebhookCommand): Promise<void> {
    await this.approveLoan.execute(command.loanId);
  }
}
