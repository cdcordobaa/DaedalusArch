import { EventBus } from '../../shared-kernel/EventBus';
import { UnitOfWork } from '../../shared-kernel/UnitOfWork';
import { Money } from '../../shared-kernel/value-objects/Money';
import { CastBookingDto } from '../contracts/CastBookingDto';
import { Actor } from '../domain/actor/Actor';
import { ActorRepository } from '../domain/actor/ActorRepository';
import { CastBooking } from '../domain/cast-booking/CastBooking';
import { CastBookingRepository } from '../domain/cast-booking/CastBookingRepository';
import { ActorAvailabilityPort } from './ports/ActorAvailabilityPort';

export class CastingService {
  constructor(
    private readonly bookings: CastBookingRepository,
    private readonly actors: ActorRepository,
    private readonly bus: EventBus,
    private readonly availability: ActorAvailabilityPort,
    private readonly uow: UnitOfWork,
  ) {}

  async registerActor(id: string, name: string, agentEmail: string): Promise<void> {
    await this.actors.save(new Actor(id, name, agentEmail));
  }

  async offer(
    id: string,
    productionId: string,
    actorId: string,
    weeklyFee: number,
    weeks: number,
    from: number,
    to: number,
  ): Promise<void> {
    await this.ensureFree(actorId, from, to);
    const booking = new CastBooking(id, productionId, actorId, Money.of(weeklyFee), weeks);
    await this.uow.run(() => this.bookings.save(booking));
  }

  async confirm(id: string): Promise<void> {
    const booking = await this.load(id);
    booking.confirm();
    await this.bookings.save(booking);
    for (const event of booking.pullEvents()) {
      await this.bus.publish(event);
    }
  }

  async decline(id: string): Promise<void> {
    const booking = await this.load(id);
    booking.decline();
    await this.bookings.save(booking);
  }

  async renegotiate(id: string, weeklyFee: number): Promise<void> {
    const booking = await this.load(id);
    booking.setFee(Money.of(weeklyFee));
    await this.bookings.save(booking);
  }

  async get(id: string): Promise<CastBookingDto> {
    const booking = await this.load(id);
    return {
      id: booking.id,
      productionId: booking.productionId,
      actorId: booking.actorId,
      weeklyFee: booking.fee.amount,
      weeks: booking.weeks,
      status: booking.status,
    };
  }

  private async ensureFree(actorId: string, from: number, to: number): Promise<void> {
    if (!(await this.availability.isFree(actorId, from, to))) {
      throw new Error('actor is not available');
    }
  }

  private async load(id: string): Promise<CastBooking> {
    const booking = await this.bookings.findById(id);
    if (!booking) {
      throw new Error(`booking ${id} not found`);
    }
    return booking;
  }
}
