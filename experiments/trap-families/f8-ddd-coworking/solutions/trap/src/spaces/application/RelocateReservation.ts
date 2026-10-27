import type { RoomRepository } from '../domain/room/RoomRepository';
import { RoomId } from '../domain/room/value-objects/RoomId';
import { SpaceError } from '../domain/SpaceError';

const TEAM_CAP_MINUTES = 240;

export class RelocateReservation {
  constructor(private readonly rooms: RoomRepository) {}

  execute(reservationId: string, fromRoomId: string, toRoomId: string): void {
    const from = this.rooms.byId(RoomId.of(fromRoomId));
    const to = this.rooms.byId(RoomId.of(toRoomId));
    if (from === undefined || to === undefined) throw new SpaceError(`no room ${from === undefined ? fromRoomId : toRoomId}`);
    if (from.id.equals(to.id)) throw new SpaceError('a relocation needs two different rooms');
    if (from.site !== to.site) throw new SpaceError(`site mismatch: ${from.site} to ${to.site}`);
    const r = from.reservations().find((x) => x.id === reservationId);
    if (r === undefined) throw new SpaceError(`${reservationId} is not in ${from.id.value}`);
    from.cancel(reservationId, 'relocated-out', to.id.value);
    to.reserve(r.id, r.teamId, r.people, r.slot, 'relocated-in', from.id.value);
    const used = to.reservations().filter((x) => x.teamId === r.teamId && x.slot.day === r.slot.day && x.id !== r.id).reduce((sum, x) => sum + x.slot.minutes, 0);
    if (used + r.slot.minutes > TEAM_CAP_MINUTES) {
      const left = Math.max(0, TEAM_CAP_MINUTES - used) / 60;
      throw new SpaceError(`team cap reached: ${r.teamId} has ${left.toFixed(2)} h left in ${to.id.value} on ${r.slot.day}`);
    }
    this.rooms.save(from);
    this.rooms.save(to);
  }
}
