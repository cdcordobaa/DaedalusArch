import express, { Express, NextFunction, Request, Response } from 'express';
import { Adoptions, AnimalManagement } from '../../application/ports/inbound';
import { InvalidOperation, NotFound } from '../../domain/errors';

export function httpApi(animals: AnimalManagement, adoptions: Adoptions, extra?: (app: Express) => void): Express {
  const app = express();
  app.use(express.json());
  app.post('/animals', (req, res) => { res.status(201).json(animals.register(req.body)); });
  app.get('/animals', (_req, res) => { res.json(animals.list()); });
  app.get('/animals/:id', (req, res) => { res.json(animals.get(req.params.id)); });
  app.post('/animals/:id/ready', (req, res) => { res.json(animals.markReady(req.params.id)); });
  app.get('/animals/:id/applications', (req, res) => { res.json(adoptions.forAnimal(req.params.id)); });
  app.post('/animals/:id/applications', (req, res) => { res.status(201).json(adoptions.apply(req.params.id, req.body.applicant, req.body.household)); });
  app.post('/applications/:id/approve', (req, res) => { res.json(adoptions.approve(req.params.id)); });
  app.post('/applications/:id/reject', (req, res) => { res.json(adoptions.reject(req.params.id)); });
  extra?.(app);
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof NotFound) res.status(404).json({ error: `${err.message} not found` });
    else if (err instanceof InvalidOperation) res.status(409).json({ error: err.message });
    else res.status(500).json({ error: 'internal error' });
  });
  return app;
}
