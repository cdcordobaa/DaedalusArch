/** What this part of the system needs to know about club members. */
export interface MemberDirectory {
  exists(memberId: string): boolean;
  /** Whole-number percent off every order for this member; 0 when there is none. */
  discountPercent(memberId: string): number;
}
