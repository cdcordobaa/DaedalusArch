import express, { Express, NextFunction, Request, Response } from 'express';
import { OrganiserUseCases } from '../../application/use-cases/organiser';
import { BookingUseCases } from '../../application/use-cases/booking';
import { SalesUseCases } from '../../application/use-cases/sales';
import { BusinessRuleError, NotFound } from '../../domain/errors';

export interface UseCases { organiser: OrganiserUseCases; booking: BookingUseCases; sales: SalesUseCases }

export function createApp(u: UseCases): Express {
  const app = express();
  app.use(express.json());
  app.post('/market-days', (req, res) => { res.status(201).json(u.organiser.createMarketDay(req.body.date)); });
  app.post('/pitches', (req, res) => { res.status(201).json(u.organiser.createPitch(req.body.number, req.body.size, Boolean(req.body.power))); });
  app.post('/readers', (req, res) => { u.organiser.assignReader(req.body.readerId, req.body.marketDayId, req.body.vendorId); res.sendStatus(204); });
  app.post('/vendors', (req, res) => { res.status(201).json(u.booking.registerVendor(req.body.businessName, req.body.contact, req.body.products ?? [])); });
  app.post('/bookings', (req, res) => { res.status(201).json(u.booking.bookPitch(req.body.vendorId, req.body.marketDayId, req.body.pitchId)); });
  app.post('/paylane/sales', (req, res) => { res.status(201).json(u.sales.acceptPayLaneSale(req.body.readerId, Number(req.body.amount), req.body.time)); });
  app.get('/vendors/:vendorId/market-days/:dayId/sales', (req, res) => { res.json(u.sales.listSales(req.params.vendorId, req.params.dayId)); });
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof NotFound) res.status(404).json({ error: `${err.message} not found` });
    else if (err instanceof BusinessRuleError) res.status(409).json({ error: err.message });
    else res.status(500).json({ error: 'unexpected error' });
  });
  return app;
}
