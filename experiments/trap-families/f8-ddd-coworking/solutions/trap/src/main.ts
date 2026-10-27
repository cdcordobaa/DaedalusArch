import { CancelReservation } from './spaces/application/CancelReservation';
import { EventRelay } from './spaces/application/EventRelay';
import { GetReservations, type ReservationLine } from './spaces/application/GetReservations';
import { OpenRoom } from './spaces/application/OpenRoom';
import { RelocateReservation } from './spaces/application/RelocateReservation';
import { ReserveRoom } from './spaces/application/ReserveRoom';
import { SendRoomListedNotice } from './spaces/application/SendRoomListedNotice';
import { InMemoryNotices } from './spaces/infrastructure/InMemoryNotices';
import { InMemoryRoomRepository } from './spaces/infrastructure/InMemoryRoomRepository';
import { RoomId } from './spaces/domain/room/value-objects/RoomId';

export interface AppOptions {
  /** Today's date as YYYY-MM-DD; defaults to the system date. */
  readonly today?: () => string;
}

/** Composition root. Every command delivers the events it stored before it returns. */
export function createApp(options: AppOptions = {}) {
  const today = options.today ?? (() => new Date().toISOString().slice(0, 10));
  const rooms = new InMemoryRoomRepository();
  const notices = new InMemoryNotices();
  const relay = new EventRelay(rooms);
  const listing = new SendRoomListedNotice(notices);
  relay.on('RoomOpened', (e) => listing.handle(e));
  const command = <T>(run: () => T): T => {
    const result = run();
    relay.deliverPending();
    return result;
  };
  return {
    openRoom: (name: string, site: string, seats: number): string => command(() => new OpenRoom(rooms).execute(name, site, seats)),
    reserve: (roomId: string, teamId: string, people: number, start: string, end: string): string =>
      command(() => new ReserveRoom(rooms).execute(roomId, teamId, people, start, end)),
    cancel: (roomId: string, reservationId: string): void => command(() => new CancelReservation(rooms).execute(roomId, reservationId)),
    relocate: (reservationId: string, fromRoomId: string, toRoomId: string): void =>
      command(() => new RelocateReservation(rooms).execute(reservationId, fromRoomId, toRoomId)),
    historyOf: (roomId: string) => rooms.byId(RoomId.of(roomId))?.history() ?? [],
    reservationsOf: (roomId: string): ReservationLine[] => new GetReservations(rooms).execute(roomId),
    notices: (): string[] => notices.all(),
  };
}
