import express, { Express, NextFunction, Request, Response } from 'express';
import { Adoptions, AnimalManagement, AuditTrail, Fostering, NotificationStatus } from '../../application/ports/inbound';
import { InvalidOperation, NotFound } from '../../domain/errors';

export function httpApi(animals: AnimalManagement, adoptions: Adoptions, fostering: Fostering, notifications: NotificationStatus, audit: AuditTrail, extra?: (app: Express) => void): Express {
  const staff = (req: Request): string => req.header('x-staff-id') ?? 'anonymous';
  const app = express();
  app.use(express.json());
  app.post('/animals', (req, res) => { res.status(201).json(animals.register(req.body, staff(req))); });
  app.get('/animals', (_req, res) => { res.json(animals.list()); });
  app.get('/animals/:id', (req, res) => { res.json(animals.get(req.params.id)); });
  app.post('/animals/:id/ready', (req, res) => { res.json(animals.markReady(req.params.id, staff(req))); });
  app.get('/animals/:id/applications', (req, res) => { res.json(adoptions.forAnimal(req.params.id)); });
  app.post('/animals/:id/applications', (req, res) => { res.status(201).json(adoptions.apply(req.params.id, req.body.applicant, req.body.household, req.header('x-staff-id') ?? 'public')); });
  app.post('/applications/:id/approve', (req, res) => { res.json(adoptions.approve(req.params.id, staff(req))); });
  app.post('/applications/:id/reject', (req, res) => { res.json(adoptions.reject(req.params.id, staff(req))); });
  app.post('/carers', (req, res) => { res.status(201).json(fostering.signUp(req.body)); });
  app.get('/carers', (_req, res) => { res.json(fostering.carers()); });
  app.post('/placements', (req, res) => { res.status(201).json(fostering.place(req.body.animalId, req.body.carerId, staff(req))); });
  app.post('/placements/:id/end', (req, res) => { res.json(fostering.endPlacement(req.params.id, staff(req))); });
  app.get('/notifications', (_req, res) => { res.json(notifications.list().map((n) => ({ id: n.id, to: n.to.name, channel: n.channel, subject: n.subject, delivery: n.delivery, history: n.history }))); });
  // TextBridge delivery webhook: { id, status }
  app.post('/webhooks/textbridge/delivery', (req, res, next) => {
    notifications.deliveryReport(String(req.body.id), req.body.status === 'delivered' ? 'delivered' : 'failed').then(() => res.sendStatus(204), next);
  });
  app.get('/animals/:id/audit', (req, res) => { res.json(audit.ofAnimal(req.params.id)); });
  app.get('/staff/:staffId/audit', (req, res) => {
    res.json(audit.byStaff(req.params.staffId, String(req.query.from ?? ''), String(req.query.to ?? '\uffff')));
  });
  extra?.(app);
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof NotFound) res.status(404).json({ error: `${err.message} not found` });
    else if (err instanceof InvalidOperation) res.status(409).json({ error: err.message });
    else res.status(500).json({ error: 'internal error' });
  });
  return app;
}
