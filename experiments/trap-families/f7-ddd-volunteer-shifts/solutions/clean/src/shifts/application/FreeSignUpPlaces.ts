import type { ShiftRepository } from '../domain/shift/ShiftRepository';
import { ShiftId } from '../domain/shift/value-objects/ShiftId';

/** Handles a withdrawn sign-up: its places are free again. */
export class FreeSignUpPlaces {
  constructor(private readonly shifts: ShiftRepository) {}

  execute(signUpId: string, shiftId: string): void {
    const shift = this.shifts.byId(ShiftId.of(shiftId));
    if (shift === undefined) return;
    shift.releaseForSignUp(signUpId);
    this.shifts.save(shift);
  }
}
