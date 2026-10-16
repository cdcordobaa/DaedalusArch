import { Request, Response, Router } from 'express';
import { StockError } from '../../business/stock/StockError';
import { CountDto, PickDto, ReceiveDto } from '../dto/requests';
import { StockController } from './StockController';

function respond(res: Response, p: Promise<unknown>): void {
  p.then((b) => res.status(200).json(b)).catch((e: unknown) => {
    if (e instanceof StockError) res.status(e.retryable ? 409 : 422).json({ error: e.message });
    else res.status(500).json({ error: 'internal' });
  });
}

export function stockRoutes(c: StockController): Router {
  return Router()
    .post('/receipts', (q: Request, s: Response) => respond(s, c.receive(q.body as unknown as ReceiveDto)))
    .post('/picks', (q: Request, s: Response) => respond(s, c.pick(q.body as unknown as PickDto)))
    .post('/counts', (q: Request, s: Response) => respond(s, c.count(q.body as unknown as CountDto)));
}
