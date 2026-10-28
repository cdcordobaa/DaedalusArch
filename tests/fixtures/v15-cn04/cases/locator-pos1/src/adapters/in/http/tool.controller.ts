import type { LendToolPort } from '../../../application/ports/in/lend-tool.port';
import { ToolError } from '../../../domain/errors';
import type { Clock } from '../../../application/ports/out/clock.port';
import { CLOCK, resolve } from '../../../application/service-registry';

export interface HttpResponse { status: number; body: { error?: string; condition?: string } }

export class ToolController {
  constructor(private readonly lendTool: LendToolPort) {}
  private readonly clock = resolve<Clock>(CLOCK);

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

  stamp(): string { return this.clock.now().toISOString(); }
}
