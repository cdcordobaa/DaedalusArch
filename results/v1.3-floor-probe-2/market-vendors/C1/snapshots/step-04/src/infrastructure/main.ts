import { MarketService } from '../application/market-service';
import { SettlementService } from '../application/settlement-service';
import { Auditing } from '../application/audit';
import { StatementService } from '../application/statement-service';
import { Pitch, Vendor } from '../domain/model';
import {
  Counter, MemoryAuditLog, MemoryBalances, MemoryBookings, MemoryFeeSettings, MemoryMarketDays, MemoryMerchantLinks,
  MemoryReaderLinks, MemorySales, MemorySettlements, MemoryStore, MemoryTransactor,
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
const fees = new MemoryFeeSettings();
const settlements = new MemorySettlements();
const balances = new MemoryBalances();
const log = new MemoryAuditLog();
const audit = new Auditing(log, new MemoryTransactor([...Object.values(repos), fees, settlements, balances, log]), ids, clock);

const market = new MarketService(repos, ids, clock);
market.useAuditing(audit);
const money = new SettlementService(repos.days, repos.pitches, repos.bookings, repos.sales, fees, settlements, balances, ids, clock, audit);
const statements = new StatementService(repos.days, repos.bookings, repos.sales, settlements, money);

buildHttpApp(market, money, audit, statements).listen(Number(process.env.PORT ?? 3000));
pollTillWaveEvery15Minutes(market, new TillWaveHttpFeed(process.env.TILLWAVE_URL ?? 'https://api.tillwave.example', process.env.TILLWAVE_KEY ?? ''));
