import express, { NextFunction, Request, Response, Router } from 'express';
import { DomainError } from '../../domain/entities/market';
import { MarketAdmin } from '../../application/use-cases/market-admin';
import { VendorUseCases } from '../../application/use-cases/vendors';
import { CardSales } from '../../application/use-cases/card-sales';

export function routes(admin: MarketAdmin, vendors: VendorUseCases, sales: CardSales): Router {
  const r = express.Router();
  r.post('/market-days', (req, res) => { res.status(201).json(admin.defineDay(req.body.date)); });
  r.get('/market-days', (_req, res) => { res.json(admin.listDays()); });
  r.post('/pitches', (req, res) => { res.status(201).json(admin.definePitch(req.body.number, req.body.size, !!req.body.hasPower)); });
  r.get('/pitches', (_req, res) => { res.json(admin.listPitches()); });
  r.get('/market-days/:id/bookings', (req, res) => { res.json(admin.bookingsFor(req.params.id)); });
  r.post('/market-days/:id/readers', (req, res) => { res.status(201).json(admin.linkReader(req.body.readerId, req.params.id, req.body.vendorId)); });
  r.post('/vendors', (req, res) => { res.status(201).json(vendors.register(req.body)); });
  r.get('/vendors', (_req, res) => { res.json(vendors.list()); });
  r.post('/vendors/:id/bookings', (req, res) => { res.status(201).json(vendors.book(req.params.id, req.body.marketDayId, req.body.pitchId)); });
  r.get('/vendors/:id/sales/:dayId', (req, res) => { res.json(sales.salesOf(req.params.id, req.params.dayId)); });
  r.post('/webhooks/paylane', (req, res) => {
    const { readerId, amount, time } = req.body as { readerId: string; amount: number; time: string };
    res.status(201).json(sales.recordPayLaneSale({ readerId, amount: Number(amount), time }));
  });
  return r;
}

export function onError(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof DomainError) res.status(422).json({ error: err.message });
  else res.status(500).json({ error: 'internal error' });
}
