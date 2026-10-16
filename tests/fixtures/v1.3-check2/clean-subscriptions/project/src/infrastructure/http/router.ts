import { Request, Response, Router } from 'express';
import { SubscriptionError } from '../../domain/errors/SubscriptionError';
import { CancelBody, SeatsBody, StartBody, SubscriptionController } from './SubscriptionController';

const STATUS = { 'not-found': 404, invalid: 400, state: 409 } as const;

function reply(res: Response, p: Promise<unknown>): void {
  p.then((b) => res.status(200).json(b), (e: unknown) => {
    if (e instanceof SubscriptionError) res.status(STATUS[e.code]).json({ error: e.message });
    else res.status(500).json({ error: 'internal' });
  });
}

export function subscriptionRouter(c: SubscriptionController): Router {
  return Router()
    .post('/subscriptions', (q: Request, s: Response) => reply(s, c.create(q.body as unknown as StartBody)))
    .post('/subscriptions/:id/seats', (q: Request, s: Response) => reply(s, c.resize(q.params['id'] ?? '', q.body as unknown as SeatsBody)))
    .post('/subscriptions/:id/cancel', (q: Request, s: Response) => reply(s, c.cancel(q.params['id'] ?? '', q.body as unknown as CancelBody)));
}
