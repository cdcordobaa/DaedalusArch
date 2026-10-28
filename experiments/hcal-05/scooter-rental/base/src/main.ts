import { PaynetClient } from 'paynet-sdk';
import { TripController } from './adapters/in/http/trip.controller';
import { ConsoleNotificationSender } from './adapters/out/notification/console-notification.sender';
import { PaynetPaymentGateway } from './adapters/out/payment/paynet-payment.gateway';
import { InMemoryScooterRepository } from './adapters/out/persistence/in-memory-scooter.repository';
import { InMemoryTripRepository } from './adapters/out/persistence/in-memory-trip.repository';
import { EndTripUseCase } from './application/end-trip.use-case';
import { LockScooterUseCase } from './application/lock-scooter.use-case';
import { StartTripUseCase } from './application/start-trip.use-case';
import { UnlockScooterUseCase } from './application/unlock-scooter.use-case';

const trips = new InMemoryTripRepository();
const scooters = new InMemoryScooterRepository();
const payments = new PaynetPaymentGateway(new PaynetClient({ apiKey: 'dev' }), 'scoot');
const notifier = new ConsoleNotificationSender();

export const controller = new TripController(
  new UnlockScooterUseCase(scooters),
  new StartTripUseCase(trips),
  new LockScooterUseCase(scooters, notifier),
  new EndTripUseCase(trips, payments, notifier),
);
