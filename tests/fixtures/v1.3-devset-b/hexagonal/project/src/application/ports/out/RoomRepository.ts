import { Room } from '../../../domain/model/Room';

/** Driven port (Cockburn 2005): room lookup, implemented by an outbound adapter. */
export interface RoomRepository {
  findById(id: string): Promise<Room | undefined>;
  findAll(): Promise<Room[]>;
}
