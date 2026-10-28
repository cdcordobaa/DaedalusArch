export interface LendToolPort {
  execute(toolId: string, member: string): Promise<void>;
}
