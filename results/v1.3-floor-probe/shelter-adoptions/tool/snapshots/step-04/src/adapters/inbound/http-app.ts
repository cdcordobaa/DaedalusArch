import express, { NextFunction, Request, Response } from 'express';
import { AnimalService, NotFoundError } from '../../application/animal-service';
import { AdoptionService } from '../../application/adoption-service';
import { FosterService } from '../../application/foster-service';
import { NotificationService } from '../../application/notification-service';
import { AuditService } from '../../application/audit-service';

export interface HttpDeps {
  animals: AnimalService;
  adoptions: AdoptionService;
  foster: FosterService;
  notifications: NotificationService;
  audit: AuditService;
}

function staffId(req: Request): string {
  const id = req.header('x-staff-id');
  if (!id) throw new Error('x-staff-id header is required');
  return id;
}

export function createHttpApp(deps: HttpDeps): express.Express {
  const app = express();
  app.use(express.json());

  app.post('/animals', (req, res) => {
    res.status(201).json(deps.animals.register(staffId(req), req.body));
  });
  app.get('/animals', (_req, res) => {
    res.json(deps.animals.list());
  });
  app.get('/animals/:id', (req, res) => {
    res.json(deps.animals.get(req.params.id));
  });
  app.post('/animals/:id/ready', (req, res) => {
    res.json(deps.animals.markReady(staffId(req), req.params.id));
  });
  app.get('/animals/:id/audit', (req, res) => {
    res.json(deps.audit.trailForAnimal(req.params.id));
  });
  app.post('/animals/:id/applications', (req, res) => {
    // submitted by the public: recorded with the staff header if present, else as 'public'
    res.status(201).json(deps.adoptions.submit(req.header('x-staff-id') ?? 'public', req.params.id, req.body));
  });
  app.get('/animals/:id/applications', (req, res) => {
    res.json(deps.adoptions.listForAnimal(req.params.id));
  });
  app.post('/applications/:id/approve', (req, res) => {
    res.json(deps.adoptions.approve(staffId(req), req.params.id));
  });
  app.post('/applications/:id/reject', (req, res) => {
    res.json(deps.adoptions.reject(staffId(req), req.params.id));
  });
  app.post('/carers', (req, res) => {
    res.status(201).json(deps.foster.signUp(req.body));
  });
  app.get('/carers', (_req, res) => {
    res.json(deps.foster.listCarers());
  });
  app.post('/placements', (req, res) => {
    res.status(201).json(deps.foster.place(staffId(req), req.body.animalId, req.body.carerId));
  });
  app.post('/placements/:id/end', (req, res) => {
    res.json(deps.foster.endPlacement(staffId(req), req.params.id));
  });
  app.get('/notifications', (_req, res) => {
    res.json(deps.notifications.list());
  });
  app.get('/staff/:staffId/changes', (req, res) => {
    const from = String(req.query.from ?? '0000');
    const to = String(req.query.to ?? '9999');
    res.json(deps.audit.changesBy(req.params.staffId, from, to));
  });
  // TextBridge delivery report webhook
  app.post('/webhooks/textbridge', (req, res) => {
    const { messageId, status } = req.body as { messageId: string; status: string };
    deps.notifications.handleDeliveryReport(messageId, status === 'delivered');
    res.status(204).end();
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    const status = err instanceof NotFoundError ? 404 : 400;
    res.status(status).json({ error: err.message });
  });
  return app;
}
