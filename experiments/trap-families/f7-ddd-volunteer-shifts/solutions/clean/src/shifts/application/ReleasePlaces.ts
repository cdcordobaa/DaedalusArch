import { ShiftError } from '../domain/ShiftError';
import type { ShiftRepository } from '../domain/shift/ShiftRepository';
import { ShiftId } from '../domain/shift/value-objects/ShiftId';

/** The volunteer coordinator gives a partner group its places back. */
export class ReleasePlaces {
  constructor(private readonly shifts: ShiftRepository) {}

  execute(shiftId: string, holder: string): void {
    const shift = this.shifts.byId(ShiftId.of(shiftId));
    if (shift === undefined) throw new ShiftError(`no shift ${shiftId}`);
    shift.release(holder);
    this.shifts.save(shift);
  }
}
