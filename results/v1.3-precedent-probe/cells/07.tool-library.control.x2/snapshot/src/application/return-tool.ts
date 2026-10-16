import type { Loan } from '../domain/loan';
import type { LoanRepository } from './ports/loan-repository';
import type { Mailer } from './ports/mailer';
import type { MemberRepository } from './ports/member-repository';
import type { ToolRepository } from './ports/tool-repository';
import type { WaitingListRepository } from './ports/waiting-list-repository';

export class ReturnTool {
  constructor(
    private readonly tools: ToolRepository,
    private readonly loans: LoanRepository,
    private readonly waitingList: WaitingListRepository,
    private readonly members: MemberRepository,
    private readonly mailer: Mailer,
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
      const next = await this.waitingList.removeFirst(toolId);
      const member = next === undefined ? undefined : await this.members.findById(next.memberId);
      if (member !== undefined) {
        await this.mailer.send(member.email, `${tool.name} is ready to collect`, `Hi ${member.name}, ${tool.name} has been returned and is ready to collect.`);
      }
    }
    return loan;
  }
}
