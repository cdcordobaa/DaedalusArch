import { Router, type Request, type Response } from 'express';
import type { CloseWorkOrder } from '../../application/close-work-order';
import type { OpenWorkOrder } from '../../application/open-work-order';
import type { OrderMissingPart } from '../../application/order-missing-part';
import type { QuoteRepair } from '../../application/quote-repair';

export interface WorkshopUseCases {
  readonly openWorkOrder: OpenWorkOrder;
  readonly quoteRepair: QuoteRepair;
  readonly closeWorkOrder: CloseWorkOrder;
  readonly orderMissingPart: OrderMissingPart;
}

function fail(res: Response, e: unknown): void {
  res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
}

export function workshopRoutes(uc: WorkshopUseCases): Router {
  const r = Router();
  r.post('/work-orders', async (req: Request, res: Response) => {
    try {
      const b = req.body as { customerName: string; bike: string; problem: string };
      res.status(201).json(await uc.openWorkOrder.execute(b.customerName, b.bike, b.problem));
    } catch (e) {
      fail(res, e);
    }
  });
  r.post('/work-orders/:id/quote', async (req: Request, res: Response) => {
    try {
      const b = req.body as { skus: string[]; hours: number };
      res.json(await uc.quoteRepair.execute(String(req.params.id), b.skus, b.hours));
    } catch (e) {
      fail(res, e);
    }
  });
  r.post('/work-orders/:id/close', async (req: Request, res: Response) => {
    try {
      res.json(await uc.closeWorkOrder.execute(String(req.params.id)));
    } catch (e) {
      fail(res, e);
    }
  });
  r.post('/work-orders/:id/parts', async (req: Request, res: Response) => {
    try {
      const b = req.body as { sku: string };
      res.status(201).json(await uc.orderMissingPart.execute(String(req.params.id), b.sku));
    } catch (e) {
      fail(res, e);
    }
  });
  return r;
}
