import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { RoomOpened } from '../domain/room/events/RoomOpened';
import type { Notices } from './ports/Notices';

export class SendRoomListedNotice {
  constructor(private readonly notices: Notices) {}

  handle(event: DomainEvent): void {
    const opened = event as RoomOpened;
    this.notices.add(opened.roomId, `Room ${opened.roomId} (${opened.name}, ${String(opened.seats)} seats) can now be reserved at ${opened.site}.`);
  }
}
