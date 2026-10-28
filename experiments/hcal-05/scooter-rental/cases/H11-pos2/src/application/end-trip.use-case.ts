import { ChargeOutcome } from '../domain/charge-outcome';
import { TripNotFoundError } from '../domain/errors';
import { FareCalculator } from '../domain/fare-calculator';
import { EndTripPort } from './ports/in/end-trip.port';
import { NotificationSenderPort } from './ports/out/notification-sender.port';
import { PaymentGatewayPort } from './ports/out/payment-gateway.port';
import { TripRepositoryPort } from './ports/out/trip-repository.port';
import { shouldRetry } from './payment-retry-policy';

export class EndTripUseCase implements EndTripPort {
  private readonly fares = new FareCalculator();
  constructor(
    private readonly trips: TripRepositoryPort,
    private readonly payments: PaymentGatewayPort,
    private readonly notifier: NotificationSenderPort,
  ) {}
  async end(tripId: string, cardToken: string): Promise<ChargeOutcome> {
    const trip = await this.trips.find(tripId);
    if (!trip) throw new TripNotFoundError(tripId);
    trip.finish(Date.now(), this.fares.price(trip.minutes));
    await this.trips.save(trip);
    let outcome = await this.payments.charge(trip.totalFare!, cardToken, trip.id);
    if (shouldRetry(outcome)) outcome = await this.payments.charge(trip.totalFare!, cardToken, trip.id);
    if (outcome !== 'paid') await this.notifier.send(trip.riderId, `Payment problem: ${outcome}`);
    return outcome;
  }
}
