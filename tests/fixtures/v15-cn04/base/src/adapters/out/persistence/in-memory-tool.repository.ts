import type { ToolRepository } from '../../../application/ports/out/tool-repository.port';
import type { Tool } from '../../../domain/tool';

export class InMemoryToolRepository implements ToolRepository {
  private readonly store = new Map<string, Tool>();

  async findById(id: string): Promise<Tool | null> {
    return this.store.get(id) ?? null;
  }

  async save(tool: Tool): Promise<void> {
    this.store.set(tool.id, tool);
  }
}
