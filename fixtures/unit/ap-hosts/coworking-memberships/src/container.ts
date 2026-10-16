import { Repository } from 'typeorm';
import { Clock } from './domain/clock';
import { BillingController } from './http/controllers/billing.controller';
import { BookingsController } from './http/controllers/bookings.controller';
import { MembersController } from './http/controllers/members.controller';
import { MembershipsController } from './http/controllers/memberships.controller';
import { InvoiceRecord } from './persistence/invoice.entity';
import { PrismaService } from './prisma/prisma';
import { DayPassesService } from './services/day-passes.service';
import { DeskBookingsService } from './services/desk-bookings.service';
import { InvoicingService } from './services/invoicing.service';
import { MembersService } from './services/members.service';
import { MembershipsService } from './services/memberships.service';
import { RoomBookingsService } from './services/room-bookings.service';

export interface Controllers {
  readonly members: MembersController;
  readonly memberships: MembershipsController;
  readonly bookings: BookingsController;
  readonly billing: BillingController;
}

/** Composition root: one instance of each service, wired by hand. */
export function buildControllers(prisma: PrismaService, invoices: Repository<InvoiceRecord>, clock: Clock): Controllers {
  return {
    members: new MembersController(new MembersService(prisma)),
    memberships: new MembershipsController(new MembershipsService(prisma, clock)),
    bookings: new BookingsController(new DeskBookingsService(prisma, clock), new RoomBookingsService(prisma)),
    billing: new BillingController(new DayPassesService(prisma), new InvoicingService(invoices, prisma)),
  };
}
