import { MarketService } from '../application/market-service';
import { Pitch, Vendor } from '../domain/model';
import { Counter, MemoryBookings, MemoryMarketDays, MemoryReaderLinks, MemorySales, MemoryStore } from './memory-stores';
import { buildHttpApp } from './http';

const market = new MarketService({
  days: new MemoryMarketDays(),
  pitches: new MemoryStore<Pitch>(),
  vendors: new MemoryStore<Vendor>(),
  bookings: new MemoryBookings(),
  readers: new MemoryReaderLinks(),
  sales: new MemorySales(),
}, new Counter());

buildHttpApp(market).listen(Number(process.env.PORT ?? 3000));
