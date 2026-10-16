import express from 'express';
import { MarketAdmin } from './application/use-cases/market-admin';
import { VendorUseCases } from './application/use-cases/vendors';
import { CardSales } from './application/use-cases/card-sales';
import {
  CounterIds, MemoryBookingRepository, MemoryMarketRepository, MemoryReaderLinkRepository, MemorySaleRepository,
  MemoryVendorRepository,
} from './infrastructure/persistence/memory';
import { onError, routes } from './infrastructure/http/routes';

const ids = new CounterIds();
const market = new MemoryMarketRepository();
const vendors = new MemoryVendorRepository();
const bookings = new MemoryBookingRepository();
const links = new MemoryReaderLinkRepository();
const sales = new MemorySaleRepository();

const app = express();
app.use(express.json());
app.use(routes(
  new MarketAdmin(market, vendors, bookings, links, ids),
  new VendorUseCases(market, vendors, bookings, ids),
  new CardSales(market, links, bookings, sales, ids),
));
app.use(onError);
app.listen(Number(process.env.PORT ?? 3000));
