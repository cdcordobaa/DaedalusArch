import express, { Express, NextFunction, Request, Response } from 'express';
import { OrganiserUseCases } from '../../application/use-cases/organiser';
import { BookingUseCases } from '../../application/use-cases/booking';
import { SalesUseCases } from '../../application/use-cases/sales';
import { FeeUseCases } from '../../application/use-cases/fees';
import { SettlementUseCase } from '../../application/use-cases/settlement';
import { AuditTrail } from '../../application/use-cases/audit';
import { StatementUseCase } from '../../application/use-cases/statement';
import { BusinessRuleError, NotFound } from '../../domain/errors';

export interface UseCases {
  organiser: OrganiserUseCases;
  booking: BookingUseCases;
  sales: SalesUseCases;
  fees: FeeUseCases;
  settlement: SettlementUseCase;
  audit: AuditTrail;
  statements: StatementUseCase;
}

const organiserId = (req: Request): string => req.get('x-organiser-id') ?? 'anonymous';

export function createApp(u: UseCases): Express {
  const app = express();
  app.use(express.json());
  app.post('/market-days', (req, res) => { res.status(201).json(u.organiser.createMarketDay(req.body.date)); });
  app.post('/pitches', (req, res) => { res.status(201).json(u.organiser.createPitch(req.body.number, req.body.size, Boolean(req.body.power))); });
  app.post('/readers', (req, res) => { u.organiser.assignReader(req.body.readerId, req.body.marketDayId, req.body.vendorId); res.sendStatus(204); });
  app.post('/vendors', (req, res) => { res.status(201).json(u.booking.registerVendor(req.body.businessName, req.body.contact, req.body.products ?? [])); });
  app.post('/bookings', (req, res) => { res.status(201).json(u.booking.bookPitch(req.body.vendorId, req.body.marketDayId, req.body.pitchId, organiserId(req))); });
  app.post('/paylane/sales', (req, res) => { res.status(201).json(u.sales.acceptPayLaneSale(req.body.readerId, Number(req.body.amount), req.body.time, req.body.id)); });
  app.get('/vendors/:vendorId/market-days/:dayId/sales', (req, res) => { res.json(u.sales.listSales(req.params.vendorId, req.params.dayId)); });
  app.post('/tillwave/merchants', (req, res) => { u.sales.assignMerchant(req.body.merchantId, req.body.vendorId); res.sendStatus(204); });
  app.post('/bookings/:id/cancel', (req, res) => { res.json(u.booking.cancelBooking(req.params.id, organiserId(req))); });
  app.get('/fees', (_req, res) => { res.json(u.fees.current()); });
  app.put('/fees/stalls/:size', (req, res) => { res.json(u.fees.setStallFee(req.params.size as 'S' | 'M' | 'L', Number(req.body.amount), organiserId(req))); });
  app.put('/fees/power', (req, res) => { res.json(u.fees.setPowerSurcharge(Number(req.body.amount), organiserId(req))); });
  app.put('/vendors/:id/commission', (req, res) => { res.json(u.fees.setVendorCommission(req.params.id, Number(req.body.rate), organiserId(req))); });
  app.post('/market-days/:id/close', (req, res) => { res.json(u.organiser.closeMarketDay(req.params.id)); });
  app.post('/market-days/:id/settle', (req, res) => { res.status(201).json(u.settlement.settle(req.params.id, organiserId(req))); });
  app.get('/market-days/:id/settlement', (req, res) => {
    const s = u.settlement.find(req.params.id);
    if (!s) { res.status(404).json({ error: 'not settled yet' }); return; }
    res.json(s);
  });
  app.get('/market-days/:id/audit', (req, res) => { res.json(u.audit.forMarketDay(req.params.id)); });
  app.get('/vendors/:id/statements/:month', (req, res) => {
    const st = u.statements.monthly(req.params.id, req.params.month);
    res.setHeader('content-disposition', `attachment; filename="statement-${req.params.month}.json"`);
    res.json(st);
  });
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof NotFound) res.status(404).json({ error: `${err.message} not found` });
    else if (err instanceof BusinessRuleError) res.status(409).json({ error: err.message });
    else res.status(500).json({ error: 'unexpected error' });
  });
  return app;
}
