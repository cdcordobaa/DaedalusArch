import { PrismaService } from './PrismaService';
import { EventData } from './schema/EventData';

export class EventStore {
  constructor(private readonly prisma: PrismaService) {}

  load(id: string): Promise<EventData | null> {
    return this.prisma.event.findUnique({ where: { id } });
  }

  upcoming(after: Date): Promise<EventData[]> {
    return this.prisma.event.findMany().then((rows) => rows.filter((r) => r.startsAt > after));
  }

  async saveSeatsSold(id: string, seatsSold: number): Promise<void> {
    await this.prisma.event.update({ where: { id }, data: { seatsSold } });
  }
}
