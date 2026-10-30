import { RhReservationStatus, RoomsHubClient } from 'rooms-hub-sdk';
import { ReservationsPort } from '../../../application/ports/out/reservations.port';
import { Stay, StayPhase } from '../../../domain/stay';

export class RoomsHubReservationsAdapter implements ReservationsPort {
  private readonly client: RoomsHubClient;

  constructor(apiKey: string) {
    this.client = new RoomsHubClient({ api_key: apiKey });
  }

  async stay(reservationId: string): Promise<Stay> {
    const r = await this.client.reservation(reservationId);
    return { reservationId: r.reservation_id, phase: this.toPhase(r.status), nightlyRateCents: r.nightly_rate_cents };
  }

  private toPhase(s: RhReservationStatus): StayPhase {
    switch (s) {
      case RhReservationStatus.PENDING_PAYMENT: return 'reserved';
      case RhReservationStatus.CONFIRMED: return 'guaranteed';
      case RhReservationStatus.CHECKED_IN: return 'in-house';
      case RhReservationStatus.CHECKED_OUT: return 'departed';
      case RhReservationStatus.CANCELLED: return 'cancelled';
    }
  }
}
