import { Booking } from '../model/Booking';
import { DateRange } from '../model/DateRange';
import { Room } from '../model/Room';

export class AvailabilityChecker {
  isAvailable(room: Room, stay: DateRange, bookings: readonly Booking[]): boolean {
    return !bookings.some((b) => b.isActive && b.roomId === room.id && b.stay.overlaps(stay));
  }
}
