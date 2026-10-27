import type { ShiftsModule } from '../../shifts';
import type { ShiftDirectory } from '../application/ports/ShiftDirectory';

/** Translates the shifts module's published calls into what sign-ups need. */
export class ShiftsDirectory implements ShiftDirectory {
  constructor(private readonly shifts: ShiftsModule) {}

  exists(shiftId: string): boolean {
    return this.shifts.shift(shiftId) !== undefined;
  }

  isCancelled(shiftId: string): boolean {
    return this.shifts.shift(shiftId)?.cancelled === true;
  }
}
