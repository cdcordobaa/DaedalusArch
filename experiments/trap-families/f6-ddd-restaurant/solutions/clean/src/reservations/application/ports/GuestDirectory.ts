import type { GuestStatus } from '../../domain/reservation/value-objects/GuestStatus';

/** What table reservations need to know about guests. */
export interface GuestDirectory {
  exists(guestId: string): boolean;
  statusOf(guestId: string): GuestStatus;
}
