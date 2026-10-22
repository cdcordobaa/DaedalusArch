import { RoomSchedule } from '../../../domain/model/RoomSchedule';

/** Driven port: room schedules. `save` rejects a schedule whose version changed since it was read. */
export interface RoomScheduleRepository {
  forRoom(roomId: string): Promise<RoomSchedule>;
  save(schedule: RoomSchedule): Promise<void>;
  nextBookingId(): string;
}
