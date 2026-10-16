import { Reservation } from '../../../domain/model/Reservation';

export interface ReservationRepository {
  byId(id: string): Promise<Reservation | undefined>;
  forSpot(spotCode: string): Promise<Reservation[]>;
  save(reservation: Reservation): Promise<void>;
}
