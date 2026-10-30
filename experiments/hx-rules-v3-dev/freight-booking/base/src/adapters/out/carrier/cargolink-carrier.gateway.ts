import { BookingReply, CargoLinkClient, CarrierRefusal } from 'cargolink-sdk';
import { CarrierBookingPort, CarrierQuery } from '../../../application/ports/out/carrier-booking.port';
import { CarrierAnswer } from '../../../domain/booking';
import { CarrierUnavailableError } from '../../../domain/errors';

export class CargoLinkCarrierGateway implements CarrierBookingPort {
  private readonly client: CargoLinkClient;

  constructor(apiKey: string) {
    this.client = new CargoLinkClient({ api_key: apiKey });
  }

  async request(query: CarrierQuery): Promise<CarrierAnswer> {
    try {
      const reply = await this.client.book({ shipper_account: query.shipperId, lane_code: query.laneCode, pallet_count: query.palletCount });
      return { reference: reply.booking_ref, outcome: this.toOutcome(reply), chargeCents: Math.round((reply.freight_charge + reply.fuel_surcharge) * 100) };
    } catch (e) {
      if (e instanceof CarrierRefusal) return { reference: '', outcome: 'refused', chargeCents: 0 };
      throw new CarrierUnavailableError(`carrier unavailable: ${String(e)}`);
    }
  }

  private toOutcome(reply: BookingReply): CarrierAnswer['outcome'] {
    switch (reply.booking_state) {
      case 'BKG_CONFIRMED':
        return 'confirmed';
      case 'BKG_PENDING':
      case 'BKG_ON_HOLD':
        return 'held';
      default:
        return 'refused';
    }
  }
}
