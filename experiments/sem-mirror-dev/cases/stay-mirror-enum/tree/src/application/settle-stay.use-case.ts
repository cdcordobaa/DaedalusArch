import { StayStatus } from '../domain/stay';
import { FolioPort } from './ports/out/folio.port';
import { ReservationsPort } from './ports/out/reservations.port';

export class SettleStayUseCase {
  constructor(private readonly reservations: ReservationsPort, private readonly folio: FolioPort) {}

  async execute(reservationId: string): Promise<void> {
    const stay = await this.reservations.stay(reservationId);
    switch (stay.status) {
      case StayStatus.NoShow:
        await this.folio.charge(reservationId, stay.nightlyRateCents, 'no show');
        break;
      case StayStatus.CxlLate:
        await this.folio.charge(reservationId, Math.round(stay.nightlyRateCents / 2), 'late cancellation');
        break;
      case StayStatus.Held:
      case StayStatus.Conf:
      case StayStatus.Cxl:
        break;
    }
  }
}
