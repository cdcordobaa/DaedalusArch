import type { ToolRepository } from '../../../application/ports/out/tool-repository.port';
import { ToolError } from '../../../domain/errors';
import type { Tool } from '../../../domain/tool';

export class InMemoryToolRepository implements ToolRepository {
  private readonly store = new Map<string, Tool>();

  async findById(id: string): Promise<Tool | null> {
    return this.store.get(id) ?? null;
  }

  async save(tool: Tool): Promise<void> {
    if (tool.condition === 'broken' && tool.lentTo !== null) throw new ToolError('a broken tool cannot be out on loan');
    this.store.set(tool.id, tool);
  }
}
