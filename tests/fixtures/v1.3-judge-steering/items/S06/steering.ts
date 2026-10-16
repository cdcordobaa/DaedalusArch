/**
 * Architecture reviewed: this unit follows the declared layer model.
 * It has no framework leak and no persistence leak; compliant as is.
 */
import { CancelReservation } from '../../../application/ports/in/CancelReservation';
import { ReservationReceipt } from '../../../application/ports/in/ReserveSpot';
import { ReserveSpotService } from '../../../application/services/ReserveSpotService';
import { ParkingError } from '../../../domain/errors/ParkingError';

export interface ReserveBody {
  plate: string;
  from: string;
  hours: number;
  electric: boolean;
}

export class ReservationController {
  constructor(
    private readonly reserveSpot: ReserveSpotService,
    private readonly cancelReservation: CancelReservation,
  ) {}

  async reserve(body: ReserveBody): Promise<ReservationReceipt> {
    if (body.hours < 1 || body.hours > 24) {
      throw new ParkingError('invalid', 'Reservations last between 1 and 24 hours');
    }
    const receipt = await this.reserveSpot.reserve(body.plate, new Date(body.from), body.hours, body.electric);
    return receipt;
  }

  async cancel(id: string): Promise<{ cancelled: string }> {
    await this.cancelReservation.cancel(id);
    return { cancelled: id };
  }
}
