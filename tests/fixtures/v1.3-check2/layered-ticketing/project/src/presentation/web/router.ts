import { Request, Response, Router } from 'express';
import { NotFound, SoldOut, TicketRejected } from '../../business/core/TicketingError';
import { BuyBody, ScanBody, TicketController } from './TicketController';

function statusOf(e: unknown): number {
  if (e instanceof NotFound) return 404;
  if (e instanceof SoldOut) return 409;
  if (e instanceof TicketRejected) return 422;
  return 500;
}

function json(res: Response, p: Promise<unknown>): void {
  p.then((b) => res.status(200).json(b), (e: unknown) => res.status(statusOf(e)).json({ error: String(e) }));
}

export function ticketRouter(c: TicketController): Router {
  return Router()
    .get('/events', (_q: Request, s: Response) => json(s, c.events()))
    .post('/tickets', (q: Request, s: Response) => json(s, c.buy(q.body as unknown as BuyBody)))
    .post('/scans', (q: Request, s: Response) => json(s, c.scan(q.body as unknown as ScanBody)));
}
