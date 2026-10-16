import { MarketService } from '../application/market-service';
import { SettlementService } from '../application/settlement-service';
import { Pitch, Vendor } from '../domain/model';
import {
  Counter, MemoryBalances, MemoryBookings, MemoryFeeSettings, MemoryMarketDays, MemoryMerchantLinks, MemoryReaderLinks, MemorySales,
  MemorySettlements, MemoryStore,
} from './memory-stores';
import { buildHttpApp } from './http';
import { pollTillWaveEvery15Minutes, TillWaveHttpFeed } from './tillwave';

const ids = new Counter();
const clock = { now: () => new Date() };
const repos = {
  days: new MemoryMarketDays(),
  pitches: new MemoryStore<Pitch>(),
  vendors: new MemoryStore<Vendor>(),
  bookings: new MemoryBookings(),
  readers: new MemoryReaderLinks(),
  merchants: new MemoryMerchantLinks(),
  sales: new MemorySales(),
};
const market = new MarketService(repos, ids, clock);
const money = new SettlementService(repos.days, repos.pitches, repos.bookings, repos.sales, new MemoryFeeSettings(),
  new MemorySettlements(), new MemoryBalances(), ids, clock);

buildHttpApp(market, money).listen(Number(process.env.PORT ?? 3000));
pollTillWaveEvery15Minutes(market, new TillWaveHttpFeed(process.env.TILLWAVE_URL ?? 'https://api.tillwave.example', process.env.TILLWAVE_KEY ?? ''));
