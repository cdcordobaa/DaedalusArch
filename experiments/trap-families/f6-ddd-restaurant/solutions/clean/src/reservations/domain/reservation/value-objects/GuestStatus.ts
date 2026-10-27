/** The guest status a reservation's deposit is set for, as table reservations see it. The status is decided by guests. */
export type GuestStatus = 'vip' | 'regular' | 'new';

/** The share of the deposit waived per status: a deposit rule of table reservations. */
export function waivedShareOf(status: GuestStatus): number {
  return status === 'vip' ? 1 : status === 'regular' ? 0.5 : 0;
}
