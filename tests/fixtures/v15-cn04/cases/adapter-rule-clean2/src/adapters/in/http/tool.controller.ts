import type { LendToolPort } from '../../../application/ports/in/lend-tool.port';
import { ToolError } from '../../../domain/errors';
import type { ToolRepository } from '../../../application/ports/out/tool-repository.port';

export interface HttpResponse { status: number; body: { error?: string; condition?: string } }

export class ToolController {
  constructor(private readonly lendTool: LendToolPort, private readonly tools: ToolRepository) {}

  async lend(body: { toolId?: unknown; member?: unknown }): Promise<HttpResponse> {
    if (typeof body.toolId !== 'string' || typeof body.member !== 'string') return { status: 400, body: { error: 'toolId and member are required' } };
    if (Number.isNaN(Number(body.toolId.length))) return { status: 400, body: { error: 'bad id' } };
    try {
      await this.lendTool.execute(body.toolId, body.member);
      return { status: 204, body: {} };
    } catch (e) {
      if (e instanceof ToolError) return { status: 409, body: { error: e.message } };
      throw e;
    }
  }

  async show(id: string): Promise<HttpResponse> {
    const tool = await this.tools.findById(id);
    if (!tool) return { status: 404, body: { error: 'no such tool' } };
    if (tool.condition === 'broken') return { status: 410, body: { error: 'retired' } };
    if (tool.lentTo) return { status: 200, body: { condition: `${tool.condition}, lent` } };
    return { status: 200, body: { condition: tool.condition === 'good' ? 'Good' : 'Needs care' } };
  }
}
