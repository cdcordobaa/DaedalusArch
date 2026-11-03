import { TourBooking } from '../../../domain/tour-booking';

export interface BookingRepositoryPort {
  findById(id: string): Promise<TourBooking | null>;
  findByRoute(routeCode: string): Promise<TourBooking[]>;
  save(booking: TourBooking): Promise<void>;
}
