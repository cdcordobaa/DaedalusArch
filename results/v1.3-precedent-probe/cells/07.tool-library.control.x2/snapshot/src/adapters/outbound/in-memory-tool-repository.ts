import type { ToolRepository } from '../../application/ports/tool-repository';
import type { Tool } from '../../domain/tool';

export class InMemoryToolRepository implements ToolRepository {
  private readonly rows = new Map<string, Tool>();

  async findById(id: string): Promise<Tool | undefined> {
    return this.rows.get(id);
  }

  async findAll(): Promise<Tool[]> {
    return [...this.rows.values()];
  }

  async save(tool: Tool): Promise<void> {
    this.rows.set(tool.id, tool);
  }
}
