/** What this part of the system needs to know about club members. */
export interface MemberDirectory {
  exists(memberId: string): boolean;
  /** Fraction taken off an order for this member (0 to 1); 0 when unknown. */
  discountRate(memberId: string): number;
}
