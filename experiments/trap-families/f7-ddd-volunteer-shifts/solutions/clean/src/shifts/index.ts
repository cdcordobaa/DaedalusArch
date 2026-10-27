import { CancelShift } from './application/CancelShift';
import { FreeSignUpPlaces } from './application/FreeSignUpPlaces';
import { GetShift } from './application/GetShift';
import { HoldPlaces } from './application/HoldPlaces';
import { OpenShift } from './application/OpenShift';
import { ReleasePlaces } from './application/ReleasePlaces';
import { TakeSignUpPlaces } from './application/TakeSignUpPlaces';
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
  /** Subscriber for a stored sign-up request (delivered after the sign-up is saved). */
  signUpRequested(signUpId: string, shiftId: string, places: number): void;
  /** Subscriber for a stored sign-up withdrawal. */
  signUpWithdrawn(signUpId: string, shiftId: string): void;
}

export function createShifts(shifts: ShiftRepository = new InMemoryShiftRepository()): ShiftsModule {
  return {
    open: (name, places) => new OpenShift(shifts).execute(name, places),
    shift: (shiftId) => new GetShift(shifts).execute(shiftId),
    holdPlaces: (shiftId, holder, places) => new HoldPlaces(shifts).execute(shiftId, holder, places),
    releasePlaces: (shiftId, holder) => new ReleasePlaces(shifts).execute(shiftId, holder),
    cancel: (shiftId) => new CancelShift(shifts).execute(shiftId),
    signUpRequested: (signUpId, shiftId, places) => new TakeSignUpPlaces(shifts).execute(signUpId, shiftId, places),
    signUpWithdrawn: (signUpId, shiftId) => new FreeSignUpPlaces(shifts).execute(signUpId, shiftId),
  };
}
