import { Request, Response, Router } from 'express';
import { ParkingError } from '../../../domain/errors/ParkingError';
import { ReservationController, ReserveBody } from './ReservationController';

const STATUS = { 'not-found': 404, unavailable: 409, invalid: 422 } as const;

function send(res: Response, p: Promise<unknown>): void {
  p.then((b) => res.status(200).json(b), (e: unknown) => {
    if (e instanceof ParkingError) res.status(STATUS[e.kind]).json({ error: e.message });
    else res.status(500).json({ error: 'internal' });
  });
}

export function reservationRoutes(c: ReservationController): Router {
  return Router()
    .post('/reservations', (q: Request, s: Response) => send(s, c.reserve(q.body as unknown as ReserveBody)))
    .post('/reservations/:id/cancel', (q: Request, s: Response) => send(s, c.cancel(q.params['id'] ?? '')));
}
