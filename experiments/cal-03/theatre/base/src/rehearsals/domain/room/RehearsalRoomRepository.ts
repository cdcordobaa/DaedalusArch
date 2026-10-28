import { RehearsalRoom } from './RehearsalRoom';

export interface RehearsalRoomRepository {
  findById(id: string): Promise<RehearsalRoom | undefined>;
  save(room: RehearsalRoom): Promise<void>;
}
