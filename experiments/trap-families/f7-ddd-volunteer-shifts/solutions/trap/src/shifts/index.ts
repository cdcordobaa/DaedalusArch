import { CancelShift } from './application/CancelShift';
import { GetShift } from './application/GetShift';
import { HoldPlaces } from './application/HoldPlaces';
import { OpenShift } from './application/OpenShift';
import { ReleasePlaces } from './application/ReleasePlaces';
import type { ShiftView } from './contracts/ShiftView';
import type { ShiftRepository } from './domain/shift/ShiftRepository';
import { InMemoryShiftRepository } from './infrastructure/InMemoryShiftRepository';

export type { ShiftView } from './contracts/ShiftView';

/** What the rest of the system may call. */
export interface ShiftsModule {
  open(name: string, places: number): string;
  shift(shiftId: string): ShiftView | undefined;
  holdPlaces(shiftId: string, holder: string, places: number): void;
  releasePlaces(shiftId: string, holder: string): void;
  cancel(shiftId: string): void;
}

export function createShifts(shifts: ShiftRepository = new InMemoryShiftRepository()): ShiftsModule {
  return {
    open: (name, places) => new OpenShift(shifts).execute(name, places),
    shift: (shiftId) => new GetShift(shifts).execute(shiftId),
    holdPlaces: (shiftId, holder, places) => new HoldPlaces(shifts).execute(shiftId, holder, places),
    releasePlaces: (shiftId, holder) => new ReleasePlaces(shifts).execute(shiftId, holder),
    cancel: (shiftId) => new CancelShift(shifts).execute(shiftId),
  };
}
