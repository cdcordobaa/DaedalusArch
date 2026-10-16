import type { MemberRepository } from './ports/member-repository';
import type { ToolRepository } from './ports/tool-repository';
import type { WaitingListRepository } from './ports/waiting-list-repository';

export class JoinWaitingList {
  constructor(
    private readonly tools: ToolRepository,
    private readonly members: MemberRepository,
    private readonly waitingList: WaitingListRepository,
  ) {}

  async execute(toolId: string, memberId: string, now = new Date()): Promise<number> {
    const tool = await this.tools.findById(toolId);
    if (tool === undefined) throw new Error(`unknown tool ${toolId}`);
    if (tool.status !== 'on-loan') throw new Error(`${tool.name} is not out; it can be borrowed now`);
    if ((await this.members.findById(memberId)) === undefined) throw new Error(`unknown member ${memberId}`);
    const queue = await this.waitingList.forTool(toolId);
    if (queue.some((e) => e.memberId === memberId)) throw new Error('member is already on the waiting list');
    await this.waitingList.append({ toolId, memberId, since: now });
    return queue.length + 1;
  }
}
