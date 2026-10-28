import { ProductionOpenedEvent } from '../../productions/contracts/ProductionOpenedEvent';
import { RoomDto } from '../contracts/RoomDto';
import { RehearsalRoom } from '../domain/room/RehearsalRoom';
import { RehearsalRoomRepository } from '../domain/room/RehearsalRoomRepository';

const FOUR_HOURS = 4 * 60 * 60 * 1000;

export class RehearsalService {
  private readonly names = new Map<string, string>();

  constructor(private readonly rooms: RehearsalRoomRepository) {}

  async registerRoom(id: string, name: string): Promise<void> {
    await this.rooms.save(new RehearsalRoom(id, name));
  }

  async bookSlot(roomId: string, productionId: string, start: number, end: number): Promise<void> {
    const room = await this.load(roomId);
    room.book(productionId, start, end);
    await this.rooms.save(room);
  }

  async release(roomId: string, productionId: string): Promise<void> {
    const room = await this.load(roomId);
    room.release(productionId);
    await this.rooms.save(room);
  }

  async reserveFor(event: ProductionOpenedEvent): Promise<void> {
    await this.bookSlot(event.roomId, event.productionId, event.firstShowAt - FOUR_HOURS, event.firstShowAt);
  }

  async get(roomId: string): Promise<RoomDto> {
    const room = await this.load(roomId);
    this.names.set(room.id, room.name);
    return {
      id: room.id,
      name: this.names.get(room.id) ?? room.name,
      slots: room.slots.map((slot) => ({ productionId: slot.productionId, start: slot.start, end: slot.end })),
    };
  }

  private async load(roomId: string): Promise<RehearsalRoom> {
    const room = await this.rooms.findById(roomId);
    if (!room) {
      throw new Error(`room ${roomId} not found`);
    }
    return room;
  }
}
