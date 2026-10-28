import type { Tool } from '../../../domain/tool';

export interface ToolRepository {
  findById(id: string): Promise<Tool | null>;
  save(tool: Tool): Promise<void>;
}
