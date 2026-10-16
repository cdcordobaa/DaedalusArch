import { DeskBooking, RoomBooking } from '@prisma/client';

export interface BookDeskInput {
  readonly memberId: string;
  readonly deskId: string;
  readonly date: string;
  readonly half: string | null;
}

export interface BookRoomInput {
  readonly memberId: string;
  readonly startsAt: string;
  readonly minutes: number;
  readonly attendees: number;
}

export interface DeskBookingView {
  readonly id: string;
  readonly deskId: string;
  readonly date: string;
  readonly half: string | null;
}

export interface RoomBookingView {
  readonly id: string;
  readonly roomId: string;
  readonly startsAt: string;
  readonly minutes: number;
  readonly attendees: number;
}

export function toDeskBookingView(b: DeskBooking): DeskBookingView {
  return { id: b.id, deskId: b.deskId, date: b.date, half: b.halfDay };
}

export function toRoomBookingView(b: RoomBooking): RoomBookingView {
  return { id: b.id, roomId: b.roomId, startsAt: b.startsAt.toISOString(), minutes: b.minutes, attendees: b.attendees };
}
