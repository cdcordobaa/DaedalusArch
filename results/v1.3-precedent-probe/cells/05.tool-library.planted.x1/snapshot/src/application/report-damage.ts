import type { Damage, Loan } from '../domain/loan';
import type { LoanRepository } from './ports/loan-repository';
import type { Mailer } from './ports/mailer';
import type { MemberRepository } from './ports/member-repository';
import type { ToolRepository } from './ports/tool-repository';

export class ReportDamage {
  constructor(
    private readonly tools: ToolRepository,
    private readonly members: MemberRepository,
    private readonly loans: LoanRepository,
    private readonly mailer: Mailer,
  ) {}

  async execute(toolId: string, damage: Damage): Promise<Loan> {
    if (damage.repairFeeCents < 0) throw new Error('repair fee must not be negative');
    const tool = await this.tools.findById(toolId);
    if (tool === undefined) throw new Error(`unknown tool ${toolId}`);
    const loan = await this.loans.findLastByTool(toolId);
    if (loan === undefined) throw new Error(`${tool.name} has no loan to charge`);
    const member = await this.members.findById(loan.memberId);
    if (member === undefined) throw new Error(`unknown member ${loan.memberId}`);
    loan.damage = damage;
    await this.loans.save(loan);
    const fee = (damage.repairFeeCents / 100).toFixed(2);
    await this.mailer.send(
      member.email,
      `${tool.name} came back damaged`,
      `Hi ${member.name}, when ${tool.name} was returned we found: ${damage.whatIsBroken}. Repair fee: ${fee} EUR.`,
    );
    return loan;
  }
}
