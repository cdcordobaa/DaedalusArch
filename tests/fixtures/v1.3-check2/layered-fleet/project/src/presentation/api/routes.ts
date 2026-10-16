import { Request, Response, Router } from 'express';
import { FleetError } from '../../business/model/FleetError';
import { HoursInput, MileageInput, OpenOrderInput, WorkshopController } from './WorkshopController';

function handle(res: Response, p: Promise<unknown>): void {
  p.then((b) => res.status(200).json(b)).catch((e: unknown) => {
    res.status(e instanceof FleetError ? e.status : 500).json({ error: e instanceof Error ? e.message : 'error' });
  });
}

export function routes(c: WorkshopController): Router {
  return Router()
    .post('/work-orders', (q: Request, s: Response) => handle(s, c.openOrder(q.body as unknown as OpenOrderInput)))
    .post('/work-orders/:id/hours', (q: Request, s: Response) => handle(s, c.logHours(q.params['id'] ?? '', q.body as unknown as HoursInput)))
    .post('/work-orders/:id/close', (q: Request, s: Response) => handle(s, c.closeOrder(q.params['id'] ?? '')))
    .post('/mileage', (q: Request, s: Response) => handle(s, c.reading(q.body as unknown as MileageInput)));
}
