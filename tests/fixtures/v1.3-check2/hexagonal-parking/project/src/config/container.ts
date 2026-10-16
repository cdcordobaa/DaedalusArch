import { DataSource } from 'typeorm';
import { CancelReservationService } from '../application/services/CancelReservationService';
import { ReserveSpotService } from '../application/services/ReserveSpotService';
import { ReservationController } from '../adapters/inbound/http/ReservationController';
import { reservationRoutes } from '../adapters/inbound/http/routes';
import { CardPaymentAdapter } from '../adapters/outbound/payment/CardPaymentAdapter';
import { InMemorySpotRepository } from '../adapters/outbound/persistence/InMemorySpotRepository';
import { TypeOrmReservationRepository } from '../adapters/outbound/persistence/TypeOrmReservationRepository';

export function buildApp(dataSource: DataSource): ReturnType<typeof reservationRoutes> {
  const reservations = new TypeOrmReservationRepository(dataSource);
  const payments = new CardPaymentAdapter();
  return reservationRoutes(
    new ReservationController(new ReserveSpotService(new InMemorySpotRepository(), reservations, payments), new CancelReservationService(reservations, payments)),
  );
}
