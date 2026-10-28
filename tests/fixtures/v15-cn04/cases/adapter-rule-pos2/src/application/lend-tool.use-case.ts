import { ToolError } from '../domain/errors';
import type { LendToolPort } from './ports/in/lend-tool.port';
import type { DepositGateway } from './ports/out/deposit-gateway.port';
import type { ToolRepository } from './ports/out/tool-repository.port';

export class LendTool implements LendToolPort {
  constructor(private readonly tools: ToolRepository, private readonly deposits: DepositGateway) {}

  async execute(toolId: string, member: string): Promise<void> {
    const tool = await this.tools.findById(toolId);
    if (!tool) throw new ToolError('no such tool');
    const held = await this.deposits.hold(member, tool);
    if (held === 'refused') throw new ToolError('the deposit was refused');
    tool.lend(member);
    await this.tools.save(tool);
  }
}
