import { CastBooking } from './CastBooking';

export interface CastBookingRepository {
  findById(id: string): Promise<CastBooking | undefined>;
  save(booking: CastBooking): Promise<void>;
  findByProduction(productionId: string): Promise<CastBooking[]>;
}
