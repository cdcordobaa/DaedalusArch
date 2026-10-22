import { CancelSailing } from './application/CancelSailing';
import { GetSailing } from './application/GetSailing';
import { HoldSeats } from './application/HoldSeats';
import { ReleaseSeats } from './application/ReleaseSeats';
import { ScheduleSailing } from './application/ScheduleSailing';
import { TakeSeats } from './application/TakeSeats';
import type { SailingView } from './contracts/SailingView';
import type { SailingRepository } from './domain/sailing/SailingRepository';
import { InMemorySailingRepository } from './infrastructure/InMemorySailingRepository';

export type { SailingView } from './contracts/SailingView';

/** What the rest of the system may call. */
export interface SailingsModule {
  schedule(route: string, departsAt: string, capacity: number): string;
  sailing(sailingId: string): SailingView | undefined;
  cancelSailing(sailingId: string): void;
  holdSeats(sailingId: string, holder: string, seats: number): void;
  releaseSeats(sailingId: string, holder: string): void;
  /** True when the seats were taken; false (and nothing taken) when the sailing has too few left. */
  takeSeats(sailingId: string, holder: string, seats: number): boolean;
}

export function createSailings(sailings: SailingRepository = new InMemorySailingRepository()): SailingsModule {
  return {
    schedule: (route, departsAt, capacity) => new ScheduleSailing(sailings).execute(route, departsAt, capacity),
    sailing: (sailingId) => new GetSailing(sailings).execute(sailingId),
    cancelSailing: (sailingId) => new CancelSailing(sailings).execute(sailingId),
    holdSeats: (sailingId, holder, seats) => new HoldSeats(sailings).execute(sailingId, holder, seats),
    releaseSeats: (sailingId, holder) => new ReleaseSeats(sailings).execute(sailingId, holder),
    takeSeats: (sailingId, holder, seats) => new TakeSeats(sailings).execute(sailingId, holder, seats),
  };
}
