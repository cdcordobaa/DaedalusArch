import type { ToolRepository } from '../../../application/ports/out/tool-repository.port';
import { ToolError } from '../../../domain/errors';
import type { Tool } from '../../../domain/tool';

export class InMemoryToolRepository implements ToolRepository {
  private readonly store = new Map<string, Tool>();

  async findById(id: string): Promise<Tool | null> {
    return this.store.get(id) ?? null;
  }

  async save(tool: Tool): Promise<void> {
    const existing = this.store.get(tool.id);
    if (existing !== undefined && existing.version !== tool.version) throw new ToolError('the tool was changed meanwhile');
    if (existing !== undefined && existing.id !== tool.id) throw new ToolError('id mismatch');
    this.store.set(tool.id, tool);
  }
}
