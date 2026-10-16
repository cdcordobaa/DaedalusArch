import { OrganiserUseCases } from './application/use-cases/organiser';
import { BookingUseCases } from './application/use-cases/booking';
import { SalesUseCases } from './application/use-cases/sales';
import { MemoryBookingRepo, MemoryMarketDayRepo, MemoryReaderRepo, MemoryRepo, MemorySaleRepo, uuids } from './infrastructure/repositories/memory';
import { Pitch } from './domain/entities/pitch';
import { Vendor } from './domain/entities/vendor';
import { createApp } from './interface/http/app';

const days = new MemoryMarketDayRepo();
const pitches = new MemoryRepo<Pitch>();
const vendors = new MemoryRepo<Vendor>();
const bookings = new MemoryBookingRepo();
const readers = new MemoryReaderRepo();
const sales = new MemorySaleRepo();

createApp({
  organiser: new OrganiserUseCases(days, pitches, vendors, readers, uuids),
  booking: new BookingUseCases(days, pitches, vendors, bookings, uuids),
  sales: new SalesUseCases(days, readers, bookings, sales, uuids),
}).listen(Number(process.env.PORT ?? 3000));
