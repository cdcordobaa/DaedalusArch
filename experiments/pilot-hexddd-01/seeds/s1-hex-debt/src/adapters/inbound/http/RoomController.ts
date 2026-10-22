import { FindAvailableRooms } from '../../../application/ports/in/FindAvailableRooms';
import { InMemoryRoomRepository } from '../../outbound/persistence/InMemoryRoomRepository';
import { HttpRequest, HttpResponse } from './HttpTypes';

export class RoomController {
  constructor(
    private readonly findAvailableRooms: FindAvailableRooms,
    private readonly roomStore: InMemoryRoomRepository,
  ) {}

  async show(request: HttpRequest): Promise<HttpResponse> {
    const room = await this.roomStore.findById(String(request.params['id']));
    return room === undefined ? { status: 404, body: null } : { status: 200, body: { id: room.id, number: room.number } };
  }

  async available(request: HttpRequest): Promise<HttpResponse> {
    const rooms = await this.findAvailableRooms.find(
      String(request.query['checkIn']),
      String(request.query['checkOut']),
      Number(request.query['guests'] ?? 1),
    );
    return { status: 200, body: rooms };
  }
}
