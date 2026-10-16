import { Request, Router } from 'express';
import { marketService } from '../business/market-service';
import { salesService } from '../business/sales-service';
import { settlementService } from '../business/settlement-service';
import { auditService } from '../business/audit-service';
import { statementService } from '../business/statement-service';
import { BusinessError } from '../business/models';

export const router = Router();

function organiser(req: Request): string {
  const id = req.header('x-organiser-id');
  if (!id) throw new BusinessError('x-organiser-id header is required', 401);
  return id;
}

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
  res.status(201).json(marketService.book(organiser(req), req.body.vendorId, req.params.dayId, Number(req.body.pitchNumber)));
});
router.get('/market-days/:dayId/bookings', (req, res) => {
  res.json(marketService.bookingsForDay(req.params.dayId));
});
router.post('/market-days/:dayId/readers', (req, res) => {
  res.status(201).json(salesService.linkReader(req.body.readerId, req.params.dayId, req.body.vendorId));
});
router.post('/market-days/:dayId/merchants', (req, res) => {
  res.status(201).json(salesService.linkMerchant(req.body.merchantId, req.params.dayId, req.body.vendorId));
});
router.get('/vendors/:vendorId/sales', (req, res) => {
  const day = typeof req.query.marketDayId === 'string' ? req.query.marketDayId : undefined;
  res.json(salesService.salesForVendor(req.params.vendorId, day));
});
router.post('/bookings/:id/cancel', (req, res) => {
  res.json(marketService.cancelBooking(organiser(req), req.params.id));
});
router.put('/vendors/:vendorId/commission-rate', (req, res) => {
  res.json(marketService.setCommissionRate(organiser(req), req.params.vendorId, Number(req.body.rate)));
});
router.get('/fees', (_req, res) => {
  res.json(marketService.getFees());
});
router.patch('/fees', (req, res) => {
  res.json(marketService.updateFees(organiser(req), req.body));
});
router.post('/market-days/:dayId/close', (req, res) => {
  res.json(settlementService.closeDay(req.params.dayId));
});
router.post('/market-days/:dayId/settlement', (req, res) => {
  res.status(201).json(settlementService.settle(organiser(req), req.params.dayId));
});
router.get('/market-days/:dayId/settlement', (req, res) => {
  res.json(settlementService.settlementsForDay(req.params.dayId));
});
router.get('/market-days/:dayId/audit', (req, res) => {
  organiser(req);
  res.json(auditService.forMarketDay(req.params.dayId));
});
router.get('/vendors/:vendorId/statements/:month', (req, res) => {
  const statement = statementService.monthly(req.params.vendorId, req.params.month);
  res.setHeader('content-disposition', `attachment; filename="statement-${req.params.vendorId}-${req.params.month}.json"`);
  res.json(statement);
});
// PayLane webhook
router.post('/webhooks/paylane', (req, res) => {
  const { readerId, amount, time, id } = req.body as { readerId: string; amount: number; time: string; id?: string };
  res.status(201).json(salesService.recordPayLaneSale(readerId, Number(amount), time, id));
});
