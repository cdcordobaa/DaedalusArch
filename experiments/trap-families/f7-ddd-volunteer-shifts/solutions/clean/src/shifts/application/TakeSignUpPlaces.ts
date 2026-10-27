import type { ShiftRepository } from '../domain/shift/ShiftRepository';
import { ShiftId } from '../domain/shift/value-objects/ShiftId';

/** Handles a sign-up's request for places on a shift. */
export class TakeSignUpPlaces {
  constructor(private readonly shifts: ShiftRepository) {}

  execute(signUpId: string, shiftId: string, places: number): void {
    const shift = this.shifts.byId(ShiftId.of(shiftId));
    if (shift === undefined) return;
    shift.holdForSignUp(signUpId, places);
    this.shifts.save(shift);
  }
}
