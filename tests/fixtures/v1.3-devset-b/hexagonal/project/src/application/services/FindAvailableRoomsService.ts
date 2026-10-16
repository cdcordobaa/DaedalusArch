import { DateRange } from '../../domain/model/DateRange';
import { AvailabilityChecker } from '../../domain/services/AvailabilityChecker';
import { AvailableRoom, FindAvailableRooms } from '../ports/in/FindAvailableRooms';
import { BookingRepository } from '../ports/out/BookingRepository';
import { RoomRepository } from '../ports/out/RoomRepository';

export class FindAvailableRoomsService implements FindAvailableRooms {
  private readonly availability = new AvailabilityChecker();

  constructor(
    private readonly rooms: RoomRepository,
    private readonly bookings: BookingRepository,
  ) {}

  async find(checkIn: string, checkOut: string, guests: number): Promise<AvailableRoom[]> {
    const stay = DateRange.parse(checkIn, checkOut);
    const active = await this.bookings.findActive();
    return (await this.rooms.findAll())
      .filter((room) => room.fits(guests) && this.availability.isAvailable(room, stay, active))
      .map((room) => ({ roomId: room.id, number: room.number, nightlyRateCents: room.nightlyRate.cents }));
  }
}
