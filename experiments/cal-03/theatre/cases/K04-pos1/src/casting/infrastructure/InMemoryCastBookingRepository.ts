import { Actor } from '../domain/actor/Actor';
import { CastBooking } from '../domain/cast-booking/CastBooking';
import { CastBookingRepository } from '../domain/cast-booking/CastBookingRepository';

export class InMemoryCastBookingRepository implements CastBookingRepository {
  private readonly rows = new Map<string, CastBooking>();
  private readonly actorRows = new Map<string, Actor>();

  async findById(id: string): Promise<CastBooking | undefined> {
    return this.rows.get(id);
  }

  async save(booking: CastBooking): Promise<void> {
    this.rows.set(booking.id, booking);
  }

  async saveWithActor(booking: CastBooking, actor: Actor): Promise<void> {
    this.rows.set(booking.id, booking);
    this.actorRows.set(actor.id, actor);
  }
}
