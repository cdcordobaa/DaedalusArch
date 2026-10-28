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

  async giveBack(body: { toolId: string; damaged: boolean }): Promise<HttpResponse> {
    const tool = await this.tools.findById(body.toolId);
    if (tool === null) return { status: 404, body: { error: 'no such tool' } };
    if (body.damaged && tool.available === false) tool.markBroken();
    await this.tools.save(tool);
    return { status: 204, body: {} };
  }
}
