import { DispatchDesk } from './adapters/in/desk/DispatchDesk';
import { MemoryJobLedger } from './adapters/out/memory/MemoryJobLedger';
import { MemoryRiderRoster } from './adapters/out/memory/MemoryRiderRoster';
import { FixedClock, SystemClock } from './adapters/out/time/clocks';
import type { Clock } from './application/ports/out/Clock';
import { AssignRiderCase } from './application/usecases/AssignRiderCase';
import { PostJobCase } from './application/usecases/PostJobCase';
import { RecordPickupCase } from './application/usecases/RecordPickupCase';
import { RiderShiftsCase } from './application/usecases/RiderShiftsCase';
import { ViewJobCase } from './application/usecases/ViewJobCase';

export interface AppOptions {
  /** ISO instant the clock is fixed at; the system clock when absent. */
  readonly now?: string;
}

/** Composition root: builds the adapters and hands them to the use cases. */
export function createApp(options: AppOptions = {}) {
  const clock: Clock = options.now === undefined ? new SystemClock() : new FixedClock(new Date(options.now));
  const ledger = new MemoryJobLedger();
  const roster = new MemoryRiderRoster();
  const dispatch = new DispatchDesk({
    post: new PostJobCase(ledger, clock),
    assign: new AssignRiderCase(ledger, roster),
    pickup: new RecordPickupCase(ledger, clock),
    view: new ViewJobCase(ledger),
    shifts: new RiderShiftsCase(roster),
  });
  return { dispatch };
}
