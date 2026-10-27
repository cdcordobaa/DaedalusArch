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

  holdPlaces(shiftId: string, holder: string, places: number): void {
    this.shifts.holdPlaces(shiftId, holder, places);
  }

  releasePlaces(shiftId: string, holder: string): void {
    this.shifts.releasePlaces(shiftId, holder);
  }
}
