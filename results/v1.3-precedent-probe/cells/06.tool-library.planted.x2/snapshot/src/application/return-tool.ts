import type { Loan } from '../domain/loan';
import { firstInLine } from '../domain/waitlist';
import type { LoanRepository } from './ports/loan-repository';
import type { Mailer } from './ports/mailer';
import type { MemberRepository } from './ports/member-repository';
import type { ToolRepository } from './ports/tool-repository';
import type { WaitlistRepository } from './ports/waitlist-repository';

export class ReturnTool {
  constructor(
    private readonly tools: ToolRepository,
    private readonly loans: LoanRepository,
    private readonly waitlist: WaitlistRepository,
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
      await this.notifyNextInLine(toolId, tool.name);
    }
    return loan;
  }

  private async notifyNextInLine(toolId: string, toolName: string): Promise<void> {
    const next = firstInLine(await this.waitlist.forTool(toolId));
    if (next === undefined) return;
    const member = await this.members.findById(next.memberId);
    await this.waitlist.remove(toolId, next.memberId);
    if (member === undefined) return;
    await this.mailer.send(member.email, `${toolName} is ready to collect`, `Hi ${member.name}, ${toolName} is back and ready for you to collect.`);
  }
}
