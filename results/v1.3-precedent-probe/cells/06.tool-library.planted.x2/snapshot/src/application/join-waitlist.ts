import type { WaitlistEntry } from '../domain/waitlist';
import type { MemberRepository } from './ports/member-repository';
import type { ToolRepository } from './ports/tool-repository';
import type { WaitlistRepository } from './ports/waitlist-repository';

export class JoinWaitlist {
  constructor(
    private readonly tools: ToolRepository,
    private readonly members: MemberRepository,
    private readonly waitlist: WaitlistRepository,
  ) {}

  async execute(toolId: string, memberId: string, now = new Date()): Promise<number> {
    const tool = await this.tools.findById(toolId);
    if (tool === undefined) throw new Error(`unknown tool ${toolId}`);
    if (tool.status !== 'on-loan') throw new Error(`${tool.name} is available, borrow it instead`);
    if ((await this.members.findById(memberId)) === undefined) throw new Error(`unknown member ${memberId}`);
    const waiting = await this.waitlist.forTool(toolId);
    if (waiting.some((e) => e.memberId === memberId)) return waiting.length;
    const entry: WaitlistEntry = { toolId, memberId, joinedAt: now };
    await this.waitlist.add(entry);
    return waiting.length + 1;
  }
}
