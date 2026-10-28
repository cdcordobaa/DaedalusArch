import { Actor } from '../actor/Actor';
import { CastBooking } from './CastBooking';

export interface CastBookingRepository {
  findById(id: string): Promise<CastBooking | undefined>;
  save(booking: CastBooking): Promise<void>;
  saveWithActor(booking: CastBooking, actor: Actor): Promise<void>;
}
