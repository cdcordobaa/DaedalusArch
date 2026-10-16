export type ToolStatus = 'available' | 'on-loan';

export interface Tool {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  status: ToolStatus;
}

export function canLend(tool: Tool): boolean {
  return tool.status === 'available';
}
