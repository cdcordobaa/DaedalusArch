import { Request, Response, Router } from 'express';
import { LendingError } from '../business/errors/LendingError';
import { LendRequest, LoanController, ReturnRequest } from './http/LoanController';
import { HttpResult } from './http/HttpTypes';

const STATUS: Record<string, number> = { NOT_FOUND: 404, INVALID: 400, CONFLICT: 409 };

function send(res: Response, work: Promise<HttpResult>): void {
  work
    .then((r) => res.status(r.status).json(r.body))
    .catch((e: unknown) => {
      if (e instanceof LendingError) res.status(STATUS[e.code] ?? 500).json({ error: e.message });
      else res.status(500).json({ error: 'internal' });
    });
}

export function loanRoutes(controller: LoanController): Router {
  return Router()
    .post('/loans', (req: Request, res: Response) => send(res, controller.lend(req.body as unknown as LendRequest)))
    .post('/returns', (req: Request, res: Response) => send(res, controller.giveBack(req.body as unknown as ReturnRequest)))
    .get('/loans/:id/history', (req: Request, res: Response) => send(res, controller.historyOf(req.params['id'] ?? '')));
}
