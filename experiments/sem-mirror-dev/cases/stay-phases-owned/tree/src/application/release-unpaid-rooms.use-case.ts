import { FolioPort } from './ports/out/folio.port';
import { ReservationsPort } from './ports/out/reservations.port';

export class SettleStayUseCase {
  constructor(private readonly reservations: ReservationsPort, private readonly folio: FolioPort) {}

  /** House rules on the arrival deadline: a reserved room is released; a guaranteed no-show pays the first night. */
  async atArrivalDeadline(reservationId: string): Promise<'released' | 'charged' | 'kept'> {
    const stay = await this.reservations.stay(reservationId);
    if (stay.phase === 'reserved') return 'released';
    if (stay.phase === 'guaranteed') {
      await this.folio.charge(reservationId, stay.nightlyRateCents, 'no show');
      return 'charged';
    }
    return 'kept';
  }
}
