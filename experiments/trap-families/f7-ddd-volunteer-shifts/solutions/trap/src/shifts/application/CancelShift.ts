import { ShiftError } from '../domain/ShiftError';
import type { ShiftRepository } from '../domain/shift/ShiftRepository';
import { ShiftId } from '../domain/shift/value-objects/ShiftId';

/** The programme manager cancels a shift (bad weather, the venue is not available). */
export class CancelShift {
  constructor(private readonly shifts: ShiftRepository) {}

  execute(shiftId: string): void {
    const shift = this.shifts.byId(ShiftId.of(shiftId));
    if (shift === undefined) throw new ShiftError(`no shift ${shiftId}`);
    shift.cancel();
    this.shifts.save(shift);
  }
}
