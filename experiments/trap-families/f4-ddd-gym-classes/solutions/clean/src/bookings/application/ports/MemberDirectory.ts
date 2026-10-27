import type { CustomerLevel } from '../../domain/booking/value-objects/CustomerLevel';

/** What class bookings need to know about gym members. */
export interface MemberDirectory {
  exists(memberId: string): boolean;
  levelOf(memberId: string): CustomerLevel;
}
