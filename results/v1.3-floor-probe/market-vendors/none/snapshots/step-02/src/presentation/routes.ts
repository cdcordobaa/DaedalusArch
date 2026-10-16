import { Router } from 'express';
import { marketService } from '../business/market-service';
import { salesService } from '../business/sales-service';
import { settlementService } from '../business/settlement-service';

export const router = Router();

router.post('/market-days', (req, res) => {
  res.status(201).json(marketService.defineMarketDay(req.body.date));
});
router.get('/market-days', (_req, res) => {
  res.json(marketService.listMarketDays());
});
router.post('/pitches', (req, res) => {
  res.status(201).json(marketService.definePitch(Number(req.body.number), req.body.size, !!req.body.hasPower));
});
router.get('/pitches', (_req, res) => {
  res.json(marketService.listPitches());
});
router.post('/vendors', (req, res) => {
  res.status(201).json(marketService.registerVendor(req.body.businessName, req.body.contact, req.body.products));
});
router.get('/vendors', (_req, res) => {
  res.json(marketService.listVendors());
});
router.post('/market-days/:dayId/bookings', (req, res) => {
  res.status(201).json(marketService.book(req.body.vendorId, req.params.dayId, Number(req.body.pitchNumber)));
});
router.get('/market-days/:dayId/bookings', (req, res) => {
  res.json(marketService.bookingsForDay(req.params.dayId));
});
router.post('/market-days/:dayId/readers', (req, res) => {
  res.status(201).json(salesService.linkReader(req.body.readerId, req.params.dayId, req.body.vendorId));
});
router.get('/vendors/:vendorId/sales', (req, res) => {
  const day = typeof req.query.marketDayId === 'string' ? req.query.marketDayId : undefined;
  res.json(salesService.salesForVendor(req.params.vendorId, day));
});
router.post('/bookings/:id/cancel', (req, res) => {
  res.json(marketService.cancelBooking(req.params.id));
});
router.put('/vendors/:vendorId/commission-rate', (req, res) => {
  res.json(marketService.setCommissionRate(req.params.vendorId, Number(req.body.rate)));
});
router.post('/market-days/:dayId/close', (req, res) => {
  res.json(settlementService.closeDay(req.params.dayId));
});
router.post('/market-days/:dayId/settlement', (req, res) => {
  res.status(201).json(settlementService.settle(req.params.dayId));
});
router.get('/market-days/:dayId/settlement', (req, res) => {
  res.json(settlementService.settlementsForDay(req.params.dayId));
});
// PayLane webhook
router.post('/webhooks/paylane', (req, res) => {
  const { readerId, amount, time } = req.body as { readerId: string; amount: number; time: string };
  res.status(201).json(salesService.recordPayLaneSale(readerId, Number(amount), time));
});
