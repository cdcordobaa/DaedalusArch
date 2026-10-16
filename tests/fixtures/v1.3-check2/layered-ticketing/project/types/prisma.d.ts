declare module '@prisma/client' {
  export interface EventRow { id: string; title: string; venueCapacity: number; seatsSold: number; startsAt: Date; priceCents: number }
  export interface TicketRow { code: string; eventId: string; customerEmail: string; seats: number; scannedAt: Date | null }
  export interface ScanRow { id: string; code: string; gate: string; at: Date }
  export interface Delegate<T, K extends keyof T> {
    findUnique(args: { where: Pick<T, K> }): Promise<T | null>;
    findMany(args?: { where?: Partial<T> }): Promise<T[]>;
    create(args: { data: T }): Promise<T>;
    update(args: { where: Pick<T, K>; data: Partial<T> }): Promise<T>;
  }
  export class PrismaClient {
    event: Delegate<EventRow, 'id'>;
    ticket: Delegate<TicketRow, 'code'>;
    scan: Delegate<ScanRow, 'id'>;
    $connect(): Promise<void>;
  }
}
