import type { CustomerTier } from '../../domain/order/value-objects/CustomerTier';

/** What this part of the system needs to know about club members. */
export interface MemberDirectory {
  exists(memberId: string): boolean;
  tierOf(memberId: string): CustomerTier;
}
