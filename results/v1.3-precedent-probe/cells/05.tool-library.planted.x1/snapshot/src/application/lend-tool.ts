import { randomUUID } from 'node:crypto';
import { dueDate, type Loan } from '../domain/loan';
import { canLend } from '../domain/tool';
import { ConsoleMailer } from '../adapters/outbound/console-mailer';
import type { LoanRepository } from './ports/loan-repository';
import type { MemberRepository } from './ports/member-repository';
import type { ToolRepository } from './ports/tool-repository';

export class LendTool {
  constructor(
    private readonly tools: ToolRepository,
    private readonly members: MemberRepository,
    private readonly loans: LoanRepository,
    private readonly mailer: ConsoleMailer,
  ) {}

  async execute(toolId: string, memberId: string, now = new Date()): Promise<Loan> {
    const tool = await this.tools.findById(toolId);
    if (tool === undefined) throw new Error(`unknown tool ${toolId}`);
    const member = await this.members.findById(memberId);
    if (member === undefined) throw new Error(`unknown member ${memberId}`);
    if (!canLend(tool)) throw new Error(`tool ${tool.name} is already on loan`);
    const loan: Loan = { id: randomUUID(), toolId, memberId, lentAt: now, dueAt: dueDate(now) };
    tool.status = 'on-loan';
    await this.tools.save(tool);
    await this.loans.save(loan);
    await this.mailer.send(
      member.email,
      `You borrowed: ${tool.name}`,
      `Hi ${member.name}, please bring ${tool.name} back by ${loan.dueAt.toDateString()}.`,
    );
    return loan;
  }
}
