import { randomUUID } from 'node:crypto';
import type { Tool } from '../domain/tool';
import type { ToolRepository } from './ports/tool-repository';

export class RegisterTool {
  constructor(private readonly tools: ToolRepository) {}

  async execute(name: string, category: string): Promise<Tool> {
    const tool: Tool = { id: randomUUID(), name, category, status: 'available' };
    await this.tools.save(tool);
    return tool;
  }
}
