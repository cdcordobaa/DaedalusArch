import express, { Express, NextFunction, Request, Response } from 'express';
import { MarketService } from '../application/market-service';
import { SettlementService } from '../application/settlement-service';
import { Auditing } from '../application/audit';
import { StatementService } from '../application/statement-service';
import { NotFoundError, RuleViolation } from '../domain/model';

const actor = (q: Request): string => q.header('x-organiser-id') ?? 'unknown';

export function buildHttpApp(market: MarketService, money: SettlementService, audit: Auditing, statements: StatementService): Express {
  const app = express();
  app.use(express.json());
  app.get('/days', (_q, s) => { s.json(market.days()); });
  app.post('/days', (q, s) => { s.status(201).json(market.addMarketDay(q.body.date)); });
  app.get('/pitches', (_q, s) => { s.json(market.pitches()); });
  app.post('/pitches', (q, s) => { s.status(201).json(market.addPitch(Number(q.body.number), q.body.size, !!q.body.power)); });
  app.get('/vendors', (_q, s) => { s.json(market.vendors()); });
  app.post('/vendors', (q, s) => { s.status(201).json(market.registerVendor(q.body.name, q.body.contact, q.body.products ?? [])); });
  app.post('/days/:dayId/bookings', (q, s) => { s.status(201).json(market.book(q.body.vendorId, q.params.dayId, q.body.pitchId, actor(q))); });
  app.post('/days/:dayId/readers', (q, s) => { market.linkReader(q.body.readerId, q.params.dayId, q.body.vendorId); s.sendStatus(204); });
  app.get('/days/:dayId/vendors/:vendorId/sales', (q, s) => { s.json(market.salesOf(q.params.vendorId, q.params.dayId)); });
  app.post('/hooks/paylane', (q, s) => { s.status(201).json(market.recordPayLaneSale(q.body.readerId, Number(q.body.amount), q.body.time, q.body.saleId)); });
  app.post('/tillwave/merchants', (q, s) => { market.linkMerchant(q.body.merchantId, q.body.vendorId); s.sendStatus(204); });
  app.post('/bookings/:id/cancel', (q, s) => { s.json(market.cancelBooking(q.params.id, actor(q))); });
  app.post('/days/:dayId/close', (q, s) => { s.json(market.closeDay(q.params.dayId)); });
  app.get('/fees', (_q, s) => { s.json(money.getFees()); });
  app.put('/fees/stall/:size', (q, s) => { s.json(money.setStallFee(q.params.size as 'small', Number(q.body.amount), actor(q))); });
  app.put('/fees/power', (q, s) => { s.json(money.setPowerSurcharge(Number(q.body.amount), actor(q))); });
  app.put('/vendors/:id/commission', (q, s) => { s.json(money.setVendorCommission(q.params.id, Number(q.body.rate), actor(q))); });
  app.post('/days/:dayId/settlement', (q, s) => { s.status(201).json(money.settle(q.params.dayId, actor(q))); });
  app.get('/days/:dayId/settlement', (q, s) => {
    const x = money.settlementOf(q.params.dayId);
    if (x) s.json(x); else s.status(404).json({ error: 'not settled' });
  });
  app.get('/days/:dayId/audit', (q, s) => { s.json(audit.ofDay(q.params.dayId)); });
  app.get('/vendors/:id/statements/:month.csv', (q, s) => {
    s.attachment(`statement-${q.params.month}.csv`).type('text/csv').send(statements.toCsv(statements.monthly(q.params.id, q.params.month)));
  });
  app.use((e: unknown, _q: Request, s: Response, _n: NextFunction) => {
    if (e instanceof NotFoundError) s.status(404).json({ error: e.message });
    else if (e instanceof RuleViolation) s.status(409).json({ error: e.message });
    else s.status(500).json({ error: 'internal' });
  });
  return app;
}
