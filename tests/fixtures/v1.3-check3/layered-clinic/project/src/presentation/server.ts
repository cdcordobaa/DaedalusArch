import { Request, Response, Router } from 'express';
import { SchedulingError } from '../business/errors/SchedulingError';
import { AppointmentsController, BookingForm, NoteForm } from './controllers/AppointmentsController';

const CODES = { unknown: 404, rejected: 422, clash: 409 } as const;

function reply(res: Response, run: () => Promise<unknown>): void {
  run().then(
    (body) => res.status(200).json(body),
    (e: unknown) => (e instanceof SchedulingError ? res.status(CODES[e.reason]).json({ message: e.message }) : res.status(500).json({ message: 'error' })),
  );
}

export function appointmentRouter(c: AppointmentsController): Router {
  return Router()
    .post('/appointments', (req: Request, res: Response) => reply(res, () => c.book(req.body as unknown as BookingForm)))
    .post('/appointments/:id/cancel', (req: Request, res: Response) => reply(res, () => c.cancel(req.params['id'] ?? '')))
    .post('/appointments/:id/notes', (req: Request, res: Response) => reply(res, () => c.addNote(req.params['id'] ?? '', req.body as unknown as NoteForm)));
}
