/** What this part of the system needs to know about club members. */
export interface MemberDirectory {
  exists(memberId: string): boolean;
  /** Percent off every order the member is entitled to. */
  discountPercent(memberId: string): number;
}
