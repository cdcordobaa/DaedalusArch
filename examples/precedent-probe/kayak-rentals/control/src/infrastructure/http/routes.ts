import { Router, type Request, type Response } from 'express';
import type { BookKayak } from '../../application/book-kayak';
import type { HandOutKayak } from '../../application/hand-out-kayak';
import type { ReturnKayak } from '../../application/return-kayak';

export interface RentalUseCases {
  readonly bookKayak: BookKayak;
  readonly handOutKayak: HandOutKayak;
  readonly returnKayak: ReturnKayak;
}

function fail(res: Response, e: unknown): void {
  res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
}

export function rentalRoutes(uc: RentalUseCases): Router {
  const r = Router();
  r.post('/bookings', async (req: Request, res: Response) => {
    try {
      const b = req.body as { kayakId: string; customerName: string; customerEmail: string; startsAt: string; endsAt: string };
      res.status(201).json(
        await uc.bookKayak.execute({ ...b, startsAt: new Date(b.startsAt), endsAt: new Date(b.endsAt) }),
      );
    } catch (e) {
      fail(res, e);
    }
  });
  r.post('/bookings/:id/hand-out', async (req: Request, res: Response) => {
    try {
      res.json(await uc.handOutKayak.execute(String(req.params.id)));
    } catch (e) {
      fail(res, e);
    }
  });
  r.post('/bookings/:id/return', async (req: Request, res: Response) => {
    try {
      res.json(await uc.returnKayak.execute(String(req.params.id)));
    } catch (e) {
      fail(res, e);
    }
  });
  return r;
}
