import { CastBookingDto } from '../contracts/CastBookingDto';
import { CastingService } from '../application/CastingService';

export class CastingController {
  constructor(private readonly service: CastingService) {}

  async offer(body: { id: string; productionId: string; actorId: string; weeklyFee: number; weeks: number; from: number; to: number }): Promise<void> {
    await this.service.offer(body.id, body.productionId, body.actorId, body.weeklyFee, body.weeks, body.from, body.to);
  }

  async confirm(id: string): Promise<void> {
    await this.service.confirm(id);
  }

  async show(id: string): Promise<CastBookingDto> {
    return this.service.get(id);
  }
}
