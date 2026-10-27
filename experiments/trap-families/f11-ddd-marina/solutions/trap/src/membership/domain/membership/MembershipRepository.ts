import type { Membership } from './Membership';

export interface MembershipRepository {
  nextId(): string;
  get(id: string): Membership | undefined;
  /** Writes the membership and appends its recorded events to the log in one step. */
  put(membership: Membership): void;
}
