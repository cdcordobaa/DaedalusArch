import type { RoomView } from '../ports/in/RoomView';
import type { RoomRepository } from '../ports/out/RoomRepository';

const MAX_PAGE = 100;

export class ListRoomsService {
  constructor(private readonly rooms: RoomRepository) {}

  async list(page: number, size: number): Promise<RoomView[]> {
    if (!Number.isInteger(page) || page < 0) throw new Error('page must be a non-negative integer');
    const limit = Math.min(Math.max(size, 1), MAX_PAGE);
    const rooms = await this.rooms.page(page * limit, limit);
    return rooms.map((r) => ({ id: r.id, number: r.number, capacity: r.capacity }));
  }
}
