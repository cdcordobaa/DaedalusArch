import type { Loan } from '../domain/loan';
import type { LoanRepository } from './ports/loan-repository';
import type { ToolRepository } from './ports/tool-repository';

export class ReturnTool {
  constructor(
    private readonly tools: ToolRepository,
    private readonly loans: LoanRepository,
  ) {}

  async execute(toolId: string, now = new Date()): Promise<Loan> {
    const loan = await this.loans.findOpenByTool(toolId);
    if (loan === undefined) throw new Error(`tool ${toolId} is not on loan`);
    loan.returnedAt = now;
    await this.loans.save(loan);
    const tool = await this.tools.findById(toolId);
    if (tool !== undefined) {
      tool.status = 'available';
      await this.tools.save(tool);
    }
    return loan;
  }
}
