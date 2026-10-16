import { CancelReservation } from '../../../application/ports/in/CancelReservation';
import { ReservationReceipt } from '../../../application/ports/in/ReserveSpot';
import { ReserveSpotService } from '../../../application/services/ReserveSpotService';

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
    const receipt = await this.reserveSpot.reserve(body.plate, new Date(body.from), body.hours, body.electric);
    return receipt;
  }

  async cancel(id: string): Promise<{ cancelled: string }> {
    await this.cancelReservation.cancel(id);
    return { cancelled: id };
  }
}
