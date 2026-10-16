import express, { Express, NextFunction, Request, Response } from 'express';
import { MarketService } from '../application/market-service';
import { NotFoundError, RuleViolation } from '../domain/model';

export function buildHttpApp(market: MarketService): Express {
  const app = express();
  app.use(express.json());
  app.get('/days', (_q, s) => { s.json(market.days()); });
  app.post('/days', (q, s) => { s.status(201).json(market.addMarketDay(q.body.date)); });
  app.get('/pitches', (_q, s) => { s.json(market.pitches()); });
  app.post('/pitches', (q, s) => { s.status(201).json(market.addPitch(Number(q.body.number), q.body.size, !!q.body.power)); });
  app.get('/vendors', (_q, s) => { s.json(market.vendors()); });
  app.post('/vendors', (q, s) => { s.status(201).json(market.registerVendor(q.body.name, q.body.contact, q.body.products ?? [])); });
  app.post('/days/:dayId/bookings', (q, s) => { s.status(201).json(market.book(q.body.vendorId, q.params.dayId, q.body.pitchId)); });
  app.post('/days/:dayId/readers', (q, s) => { market.linkReader(q.body.readerId, q.params.dayId, q.body.vendorId); s.sendStatus(204); });
  app.get('/days/:dayId/vendors/:vendorId/sales', (q, s) => { s.json(market.salesOf(q.params.vendorId, q.params.dayId)); });
  app.post('/hooks/paylane', (q, s) => { s.status(201).json(market.recordPayLaneSale(q.body.readerId, Number(q.body.amount), q.body.time)); });
  app.use((e: unknown, _q: Request, s: Response, _n: NextFunction) => {
    if (e instanceof NotFoundError) s.status(404).json({ error: e.message });
    else if (e instanceof RuleViolation) s.status(409).json({ error: e.message });
    else s.status(500).json({ error: 'internal' });
  });
  return app;
}
