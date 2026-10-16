import { FindAvailableRooms } from '../../../application/ports/in/FindAvailableRooms';
import { HttpRequest, HttpResponse } from './HttpTypes';

export class RoomController {
  constructor(private readonly findAvailableRooms: FindAvailableRooms) {}

  async available(request: HttpRequest): Promise<HttpResponse> {
    const rooms = await this.findAvailableRooms.find(
      String(request.query['checkIn']),
      String(request.query['checkOut']),
      Number(request.query['guests'] ?? 1),
    );
    return { status: 200, body: rooms };
  }
}
