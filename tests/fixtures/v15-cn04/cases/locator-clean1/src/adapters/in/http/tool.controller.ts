import type { LendToolPort } from '../../../application/ports/in/lend-tool.port';
import { ToolError } from '../../../domain/errors';
import { label } from './format';

export interface HttpResponse { status: number; body: { error?: string; condition?: string } }

export class ToolController {
  constructor(private readonly lendTool: LendToolPort) {}

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

  title(name: string): string { return label(name); }
}
