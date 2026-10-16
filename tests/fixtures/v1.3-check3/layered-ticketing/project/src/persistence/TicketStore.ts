import { PrismaService } from './PrismaService';
import { TicketData } from './schema/EventData';

export class TicketStore {
  constructor(private readonly prisma: PrismaService) {}

  load(code: string): Promise<TicketData | null> {
    return this.prisma.ticket.findUnique({ where: { code } });
  }

  async add(ticket: TicketData): Promise<void> {
    await this.prisma.ticket.create({ data: ticket });
  }

  async markScanned(code: string, at: Date): Promise<void> {
    await this.prisma.ticket.update({ where: { code }, data: { scannedAt: at } });
  }
}
