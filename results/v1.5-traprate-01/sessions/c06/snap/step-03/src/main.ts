import { DispatchDesk } from './adapters/in/desk/DispatchDesk';
import { TrackpointClient } from './adapters/out/gps/TrackpointClient';
import { TrackpointPositions } from './adapters/out/gps/TrackpointPositions';
import { MemoryJobLedger } from './adapters/out/memory/MemoryJobLedger';
import { MemoryRiderRoster } from './adapters/out/memory/MemoryRiderRoster';
import { FixedClock, SystemClock } from './adapters/out/time/clocks';
import type { Clock } from './application/ports/out/Clock';
import { AssignRiderCase } from './application/usecases/AssignRiderCase';
import { ConfirmDeliveryCase } from './application/usecases/ConfirmDeliveryCase';
import { EstimateArrivalCase } from './application/usecases/EstimateArrivalCase';
import { PostJobCase } from './application/usecases/PostJobCase';
import { RecordPickupCase } from './application/usecases/RecordPickupCase';
import { RiderShiftsCase } from './application/usecases/RiderShiftsCase';
import { SuggestRiderCase } from './application/usecases/SuggestRiderCase';
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
  const positions = new TrackpointPositions(new TrackpointClient());
  const dispatch = new DispatchDesk({
    post: new PostJobCase(ledger, clock),
    assign: new AssignRiderCase(ledger, roster),
    pickup: new RecordPickupCase(ledger, clock),
    confirm: new ConfirmDeliveryCase(ledger, roster, clock),
    view: new ViewJobCase(ledger),
    shifts: new RiderShiftsCase(roster),
    suggest: new SuggestRiderCase(ledger, roster, positions, clock),
    estimate: new EstimateArrivalCase(ledger, roster, positions, clock),
  });
  return { dispatch };
}
