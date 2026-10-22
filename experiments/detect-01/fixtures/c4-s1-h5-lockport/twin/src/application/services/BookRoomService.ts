import { Booking } from '../../domain/model/Booking';
import { DateRange } from '../../domain/model/DateRange';
import type { RoomScheduleRepository } from '../ports/out/RoomScheduleRepository';

export class BookRoomService {
  constructor(private readonly schedules: RoomScheduleRepository) {}

  async book(roomId: string, stay: DateRange): Promise<Booking> {
    const schedule = await this.schedules.forRoom(roomId);
    const booking = schedule.book(this.schedules.nextBookingId(), stay);
    await this.schedules.save(schedule);
    return booking;
  }
}
