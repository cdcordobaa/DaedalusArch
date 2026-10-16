import { Request, Response, Router } from 'express';
import { PayrollRuleError, UnknownRecordError } from '../../business/model/PayrollRuleError';
import { HoursPayload, PayrollController } from './PayrollController';

function out(res: Response, work: Promise<unknown>): void {
  work.then(
    (body) => res.status(200).json(body),
    (e: unknown) => res.status(e instanceof UnknownRecordError ? 404 : e instanceof PayrollRuleError ? 422 : 500).json({ error: String(e) }),
  );
}

export function payrollRouter(c: PayrollController): Router {
  const actor = (q: Request): string => q.header('x-user') ?? 'anonymous';
  return Router()
    .post('/timesheets', (q: Request, s: Response) => out(s, c.submit(actor(q), q.body as unknown as HoursPayload)))
    .post('/timesheets/:id/approve', (q: Request, s: Response) => out(s, c.approve(actor(q), q.params['id'] ?? '')))
    .get('/payroll/:week', (q: Request, s: Response) => out(s, c.export(q.params['week'] ?? '')));
}
