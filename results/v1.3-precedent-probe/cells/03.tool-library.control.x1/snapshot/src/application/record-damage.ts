import { formatFee, type DamageReport } from '../domain/loan';
import type { LoanRepository } from './ports/loan-repository';
import type { Mailer } from './ports/mailer';
import type { MemberRepository } from './ports/member-repository';
import type { ToolRepository } from './ports/tool-repository';

export class RecordDamage {
  constructor(
    private readonly tools: ToolRepository,
    private readonly members: MemberRepository,
    private readonly loans: LoanRepository,
    private readonly mailer: Mailer,
  ) {}

  async execute(toolId: string, description: string, repairFeeCents: number, now = new Date()): Promise<DamageReport> {
    if (repairFeeCents < 0) throw new Error('repair fee must not be negative');
    const tool = await this.tools.findById(toolId);
    if (tool === undefined) throw new Error(`unknown tool ${toolId}`);
    const loan = await this.loans.findLatestByTool(toolId);
    if (loan === undefined) throw new Error(`tool ${tool.name} has never been lent`);
    const member = await this.members.findById(loan.memberId);
    if (member === undefined) throw new Error(`unknown member ${loan.memberId}`);
    const report: DamageReport = { description, repairFeeCents, recordedAt: now };
    loan.damage = report;
    await this.loans.save(loan);
    await this.mailer.send(
      member.email,
      `Damage to ${tool.name}`,
      `Hi ${member.name}, ${tool.name} came back damaged: ${description}. The repair fee is ${formatFee(repairFeeCents)}.`,
    );
    return report;
  }
}
