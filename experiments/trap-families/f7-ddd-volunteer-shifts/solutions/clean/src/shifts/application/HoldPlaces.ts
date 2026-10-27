import { ShiftError } from '../domain/ShiftError';
import type { ShiftRepository } from '../domain/shift/ShiftRepository';
import { ShiftId } from '../domain/shift/value-objects/ShiftId';

/** The volunteer coordinator holds a block of places for a partner group (a company volunteering day, a school). */
export class HoldPlaces {
  constructor(private readonly shifts: ShiftRepository) {}

  execute(shiftId: string, holder: string, places: number): void {
    const shift = this.shifts.byId(ShiftId.of(shiftId));
    if (shift === undefined) throw new ShiftError(`no shift ${shiftId}`);
    shift.hold(holder, places);
    this.shifts.save(shift);
  }
}
