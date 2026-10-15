import { Clock } from '../domain/clock';
import { DeskDay, HalfDay, isIsoDate } from '../domain/desk-day';
import { Membership, MembershipStatus } from '../domain/membership';
import { MembershipPlan } from '../domain/membership-plan';
import { SlotTakenError } from '../domain/booking-slot';
import { PrismaService } from '../prisma/prisma';
import { ConflictError, NotFoundError, ValidationError } from './errors';
import { DeskBookingView, toDeskBookingView } from './dto/booking.dto';

export class DeskBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async book(memberId: string, deskId: string, date: string, half: string | null): Promise<DeskBookingView> {
    if (!isIsoDate(date)) {
      throw new ValidationError(`date must look like 2024-06-03; got ${date}`);
    }
    if (half !== null && half !== 'morning' && half !== 'afternoon') {
      throw new ValidationError('half is "morning", "afternoon" or omitted for the whole day');
    }
    const today = this.clock.now().toISOString().slice(0, 10);
    if (date < today) {
      throw new ValidationError('Desks cannot be booked in the past');
    }
    const row = await this.prisma.membership.findFirst({ where: { memberId, status: 'active' } });
    if (row === null) {
      throw new NotFoundError(`Member ${memberId} has no active membership`);
    }
    const membership = new Membership(row.id, row.memberId, MembershipPlan.byCode(row.planCode), row.status as MembershipStatus, row.pausedUntil);
    if (!membership.canBookDesks()) {
      throw new ConflictError(`The ${membership.plan.code} plan does not include desk days`);
    }
    const wanted = new DeskDay(deskId, date, half as HalfDay | null);
    for (const b of await this.prisma.deskBooking.findMany({ where: { deskId, date } })) {
      if (wanted.clashesWith(new DeskDay(b.deskId, b.date, b.halfDay as HalfDay | null))) {
        throw new SlotTakenError(`Desk ${deskId}`);
      }
    }
    const booking = await this.prisma.deskBooking.create({ data: { deskId, memberId, date, halfDay: half } });
    return toDeskBookingView(booking);
  }

  async cancel(bookingId: string, memberId: string): Promise<void> {
    const booking = await this.prisma.deskBooking.findUnique({ where: { id: bookingId } });
    if (booking === null || booking.memberId !== memberId) {
      throw new NotFoundError(`Booking ${bookingId} not found`);
    }
    await this.prisma.deskBooking.delete({ where: { id: bookingId } });
  }

  async forDay(date: string): Promise<DeskBookingView[]> {
    return (await this.prisma.deskBooking.findMany({ where: { date }, orderBy: { deskId: 'asc' } })).map(toDeskBookingView);
  }
}
