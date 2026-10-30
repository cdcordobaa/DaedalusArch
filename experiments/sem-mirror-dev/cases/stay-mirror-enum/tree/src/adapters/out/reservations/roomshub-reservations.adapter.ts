import { RhReservationStatus, RoomsHubClient } from 'rooms-hub-sdk';
import { ReservationsPort } from '../../../application/ports/out/reservations.port';
import { Stay, StayStatus } from '../../../domain/stay';

const STATUS: Record<RhReservationStatus, StayStatus> = {
  [RhReservationStatus.HELD]: StayStatus.Held,
  [RhReservationStatus.CONF]: StayStatus.Conf,
  [RhReservationStatus.NOSHOW]: StayStatus.NoShow,
  [RhReservationStatus.CXL]: StayStatus.Cxl,
  [RhReservationStatus.CXL_LATE]: StayStatus.CxlLate,
};

export class RoomsHubReservationsAdapter implements ReservationsPort {
  private readonly client: RoomsHubClient;

  constructor(apiKey: string) {
    this.client = new RoomsHubClient({ api_key: apiKey });
  }

  async stay(reservationId: string): Promise<Stay> {
    const r = await this.client.reservation(reservationId);
    return { reservationId: r.reservation_id, status: STATUS[r.status], nightlyRateCents: r.nightly_rate_cents };
  }
}
