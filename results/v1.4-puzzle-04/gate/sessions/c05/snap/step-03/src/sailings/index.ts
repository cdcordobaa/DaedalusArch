import { CancelSailing } from './application/CancelSailing';
import { GetSailing } from './application/GetSailing';
import { HoldSeats } from './application/HoldSeats';
import { ReleaseSeats } from './application/ReleaseSeats';
import { ReserveSeats } from './application/ReserveSeats';
import { ScheduleSailing } from './application/ScheduleSailing';
import type { SailingView } from './contracts/SailingView';
import type { SailingRepository } from './domain/sailing/SailingRepository';
import { InMemorySailingRepository } from './infrastructure/InMemorySailingRepository';

export type { SailingView } from './contracts/SailingView';

/** What the rest of the system may call. */
export interface SailingsModule {
  schedule(route: string, departsAt: string, capacity: number): string;
  sailing(sailingId: string): SailingView | undefined;
  /** Calls the sailing off: no new seats are taken on it. */
  cancelSailing(sailingId: string): void;
  holdSeats(sailingId: string, holder: string, seats: number): void;
  releaseSeats(sailingId: string, holder: string): void;
  /** Takes the seats if enough are left (SeatsReserved), otherwise nothing (SeatsRefused). */
  reserveSeats(sailingId: string, holder: string, seats: number): void;
}

export function createSailings(sailings: SailingRepository = new InMemorySailingRepository()): SailingsModule {
  return {
    schedule: (route, departsAt, capacity) => new ScheduleSailing(sailings).execute(route, departsAt, capacity),
    sailing: (sailingId) => new GetSailing(sailings).execute(sailingId),
    cancelSailing: (sailingId) => new CancelSailing(sailings).execute(sailingId),
    holdSeats: (sailingId, holder, seats) => new HoldSeats(sailings).execute(sailingId, holder, seats),
    releaseSeats: (sailingId, holder) => new ReleaseSeats(sailings).execute(sailingId, holder),
    reserveSeats: (sailingId, holder, seats) => new ReserveSeats(sailings).execute(sailingId, holder, seats),
  };
}
