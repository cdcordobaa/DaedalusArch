import type { Tool } from '../../domain/tool';

export interface ToolRepository {
  findById(id: string): Promise<Tool | undefined>;
  findAll(): Promise<Tool[]>;
  save(tool: Tool): Promise<void>;
}
