import express, { NextFunction, Request, Response, Router } from 'express';
import { DomainError } from '../../domain/entities/market';
import { MarketAdmin } from '../../application/use-cases/market-admin';
import { VendorUseCases } from '../../application/use-cases/vendors';
import { CardSales } from '../../application/use-cases/card-sales';
import { Fees, RunSettlement } from '../../application/use-cases/settlement';
import { AuditLog } from '../../application/use-cases/audit';
import { Statements } from '../../application/use-cases/statements';

const organiser = (req: Request): string => req.header('x-organiser-id') ?? 'unknown';

export function routes(
  admin: MarketAdmin, vendors: VendorUseCases, sales: CardSales, fees: Fees, settlement: RunSettlement, audit: AuditLog, statements: Statements,
): Router {
  const r = express.Router();
  r.post('/market-days', (req, res) => { res.status(201).json(admin.defineDay(req.body.date)); });
  r.get('/market-days', (_req, res) => { res.json(admin.listDays()); });
  r.post('/pitches', (req, res) => { res.status(201).json(admin.definePitch(req.body.number, req.body.size, !!req.body.hasPower)); });
  r.get('/pitches', (_req, res) => { res.json(admin.listPitches()); });
  r.get('/market-days/:id/bookings', (req, res) => { res.json(admin.bookingsFor(req.params.id)); });
  r.post('/market-days/:id/readers', (req, res) => { res.status(201).json(admin.linkReader(req.body.readerId, req.params.id, req.body.vendorId)); });
  r.post('/vendors', (req, res) => { res.status(201).json(vendors.register(req.body)); });
  r.get('/vendors', (_req, res) => { res.json(vendors.list()); });
  r.post('/vendors/:id/bookings', (req, res) => { res.status(201).json(vendors.book(req.params.id, req.body.marketDayId, req.body.pitchId, organiser(req))); });
  r.get('/vendors/:id/sales/:dayId', (req, res) => { res.json(sales.salesOf(req.params.id, req.params.dayId)); });
  r.post('/webhooks/paylane', (req, res) => {
    const { readerId, amount, time, id } = req.body as { readerId: string; amount: number; time: string; id?: string };
    res.status(201).json(sales.recordPayLaneSale({ readerId, amount: Number(amount), time, saleId: id }));
  });
  r.post('/tillwave/merchants', (req, res) => { sales.linkMerchant(req.body.merchantId, req.body.vendorId); res.status(204).end(); });
  r.post('/bookings/:id/cancel', (req, res) => { res.json(vendors.cancel(req.params.id, organiser(req))); });
  r.get('/fees', (_req, res) => { res.json(fees.schedule()); });
  r.put('/fees/stall/:size', (req, res) => { res.json(fees.setStallFee(req.params.size as 'small' | 'medium' | 'large', Number(req.body.fee), organiser(req))); });
  r.put('/fees/power', (req, res) => { res.json(fees.setPowerSurcharge(Number(req.body.amount), organiser(req))); });
  r.put('/vendors/:id/commission', (req, res) => { fees.setCommission(req.params.id, Number(req.body.rate), organiser(req)); res.status(204).end(); });
  r.post('/market-days/:id/close', (req, res) => { res.json(admin.closeDay(req.params.id)); });
  r.post('/market-days/:id/settlement', (req, res) => { res.status(201).json(settlement.run(req.params.id, organiser(req))); });
  r.get('/market-days/:id/settlement', (req, res) => {
    const s = settlement.get(req.params.id);
    if (s) res.json(s); else res.status(404).json({ error: 'not settled' });
  });
  r.get('/market-days/:id/audit', (req, res) => { res.json(audit.forDay(req.params.id)); });
  r.get('/vendors/:id/statements/:month', (req, res) => {
    const st = statements.monthly(req.params.id, req.params.month);
    if (req.query.format === 'csv') {
      res.setHeader('content-disposition', `attachment; filename="statement-${req.params.id}-${req.params.month}.csv"`);
      res.type('text/csv').send(statements.csv(st));
    } else res.json(st);
  });
  return r;
}

export function onError(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof DomainError) res.status(422).json({ error: err.message });
  else res.status(500).json({ error: 'internal error' });
}
