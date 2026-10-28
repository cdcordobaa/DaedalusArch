import { RoomDto } from '../contracts/RoomDto';
import { RehearsalService } from '../application/RehearsalService';

export class RehearsalController {
  constructor(private readonly service: RehearsalService) {}

  async book(body: { roomId: string; productionId: string; start: number; end: number }): Promise<void> {
    if (!Number.isFinite(body.start) || !Number.isFinite(body.end)) {
      throw new Error('start and end must be numbers');
    }
    await this.service.bookSlot(body.roomId, body.productionId, body.start, body.end);
  }

  async show(roomId: string): Promise<RoomDto> {
    return this.service.get(roomId);
  }
}
