import { BookingSlot, BookingTooLongError, MAX_BOOKING_MINUTES, SlotTakenError, SLOT_MINUTES } from '../domain/booking-slot';
import { CreditBalance } from '../domain/credit-balance';
import { PrismaService } from '../prisma/prisma';
import { NotFoundError, ValidationError } from './errors';
import { RoomBookingView, toRoomBookingView } from './dto/booking.dto';

export class RoomBookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async book(roomId: string, memberId: string, startsAt: string, minutes: number, attendees: number): Promise<RoomBookingView> {
    if (minutes <= 0 || minutes % SLOT_MINUTES !== 0) {
      throw new ValidationError(`Rooms are booked in steps of ${String(SLOT_MINUTES)} minutes`);
    }
    if (minutes > MAX_BOOKING_MINUTES) {
      throw new BookingTooLongError(minutes);
    }
    if (attendees < 1) {
      throw new ValidationError('A booking needs at least one attendee');
    }
    const room = await this.prisma.meetingRoom.findUnique({ where: { id: roomId } });
    if (room === null) {
      throw new NotFoundError(`Room ${roomId} not found`);
    }
    if (attendees > room.seats) {
      throw new ValidationError(`${room.name} seats ${String(room.seats)}`);
    }
    const slot = new BookingSlot(new Date(startsAt), minutes);
    const sameDay = await this.prisma.roomBooking.findMany({ where: { roomId } });
    if (sameDay.some((b) => slot.overlaps(new BookingSlot(b.startsAt, b.minutes)))) {
      throw new SlotTakenError(room.name);
    }
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.findFirst({ where: { memberId, status: 'active' } });
      if (membership === null) {
        throw new NotFoundError(`Member ${memberId} has no active membership`);
      }
      const left = new CreditBalance(membership.meetingCredits).spend(slot.halfHours() * room.creditsPerHalfHour);
      await tx.membership.update({ where: { id: membership.id }, data: { meetingCredits: left.credits } });
      return toRoomBookingView(await tx.roomBooking.create({ data: { roomId, memberId, startsAt: slot.start, minutes, attendees } }));
    });
  }

  async cancel(bookingId: string): Promise<void> {
    const booking = await this.prisma.roomBooking.findUnique({ where: { id: bookingId } });
    if (booking === null) {
      throw new NotFoundError(`Booking ${bookingId} not found`);
    }
    await this.prisma.roomBooking.delete({ where: { id: bookingId } });
  }

  async forRoom(roomId: string): Promise<RoomBookingView[]> {
    return (await this.prisma.roomBooking.findMany({ where: { roomId }, orderBy: { startsAt: 'asc' } })).map(toRoomBookingView);
  }
}
