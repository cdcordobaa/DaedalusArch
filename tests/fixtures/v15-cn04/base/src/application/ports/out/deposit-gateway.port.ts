/** Holds a member's deposit before a tool leaves the shelf. */
export interface DepositGateway {
  hold(member: string, cents: number): Promise<'held' | 'refused'>;
}
