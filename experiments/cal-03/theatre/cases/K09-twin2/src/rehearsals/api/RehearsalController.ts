import { RoomDto } from '../contracts/RoomDto';
import { RehearsalService } from '../application/RehearsalService';

export class RehearsalController {
  constructor(private readonly service: RehearsalService) {}

  async book(body: { roomId: string; productionId: string; start: number; end: number }): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.service.bookSlot(body.roomId, body.productionId, body.start, body.end);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'unknown' };
    }
  }

  async show(roomId: string): Promise<RoomDto> {
    return this.service.get(roomId);
  }
}
