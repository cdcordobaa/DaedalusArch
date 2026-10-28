import type { Tool } from '../../../domain/tool';

/** Holds a member's deposit before a tool leaves the shelf. */
export interface DepositGateway {
  hold(member: string, tool: Tool): Promise<'held' | 'refused'>;
}
