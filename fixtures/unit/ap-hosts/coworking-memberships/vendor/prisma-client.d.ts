// Minimal typings of a generated @prisma/client for schema.prisma (models Member, Membership, Desk, DeskBooking,
// MeetingRoom, RoomBooking, DayPass).
export interface Member {
  id: string;
  fullName: string;
  email: string;
  company: string | null;
  createdAt: Date;
}
export interface Membership {
  id: string;
  memberId: string;
  planCode: string;
  status: string;
  startsOn: Date;
  pausedUntil: Date | null;
  meetingCredits: number;
}
export interface Desk {
  id: string;
  label: string;
  zone: string;
  standing: boolean;
}
export interface DeskBooking {
  id: string;
  deskId: string;
  memberId: string;
  date: string;
  halfDay: string | null;
}
export interface MeetingRoom {
  id: string;
  name: string;
  seats: number;
  creditsPerHalfHour: number;
}
export interface RoomBooking {
  id: string;
  roomId: string;
  memberId: string;
  startsAt: Date;
  minutes: number;
  attendees: number;
}
export interface DayPass {
  id: string;
  email: string;
  date: string;
  quantity: number;
  priceCents: number;
}
type Where<T> = { [K in keyof T]?: T[K] | { gte?: T[K]; lt?: T[K]; in?: T[K][] } };
export interface Delegate<T> {
  findUnique(args: { where: { id: string } }): Promise<T | null>;
  findFirst(args: { where: Where<T> }): Promise<T | null>;
  findMany(args?: { where?: Where<T>; orderBy?: { [K in keyof T]?: 'asc' | 'desc' }; take?: number }): Promise<T[]>;
  count(args?: { where?: Where<T> }): Promise<number>;
  create(args: { data: Omit<T, 'id' | 'createdAt'> & Partial<Pick<T, Extract<keyof T, 'id' | 'createdAt'>>> }): Promise<T>;
  update(args: { where: { id: string }; data: Partial<T> }): Promise<T>;
  delete(args: { where: { id: string } }): Promise<T>;
}
export declare class PrismaClient {
  constructor(options?: { log?: string[] });
  readonly member: Delegate<Member>;
  readonly membership: Delegate<Membership>;
  readonly desk: Delegate<Desk>;
  readonly deskBooking: Delegate<DeskBooking>;
  readonly meetingRoom: Delegate<MeetingRoom>;
  readonly roomBooking: Delegate<RoomBooking>;
  readonly dayPass: Delegate<DayPass>;
  $transaction<R>(fn: (tx: PrismaClient) => Promise<R>): Promise<R>;
  $disconnect(): Promise<void>;
}
