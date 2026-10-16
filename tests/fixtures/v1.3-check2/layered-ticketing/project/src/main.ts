import { BoxOffice } from './business/logic/BoxOffice';
import { GateLog } from './business/logic/GateLog';
import { EventStore } from './persistence/EventStore';
import { PrismaService } from './persistence/PrismaService';
import { TicketStore } from './persistence/TicketStore';
import { TicketController } from './presentation/web/TicketController';
import { ticketRouter } from './presentation/web/router';

export async function start(): Promise<ReturnType<typeof ticketRouter>> {
  const prisma = await new PrismaService().ready();
  return ticketRouter(new TicketController(new BoxOffice(new EventStore(prisma), new TicketStore(prisma)), new GateLog(prisma)));
}
