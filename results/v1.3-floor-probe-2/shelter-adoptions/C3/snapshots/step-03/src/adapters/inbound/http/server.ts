import express, { Express, NextFunction, Request, Response } from 'express';
import { Shelter } from '../../../application/shelter';
import { ShelterError } from '../../../domain/model';

const STATUS = { 'not-found': 404, conflict: 409, invalid: 400 } as const;

export function createServer(shelter: Shelter): Express {
  const app = express();
  app.use(express.json());
  app.post('/animals', (req, res) => { res.status(201).json(shelter.registerAnimal(req.body)); });
  app.get('/animals', (_req, res) => { res.json(shelter.listAnimals()); });
  app.post('/animals/:id/ready', (req, res) => { res.json(shelter.markReady(req.params.id)); });
  app.get('/animals/:id/applications', (req, res) => { res.json(shelter.applicationsOf(req.params.id)); });
  app.post('/applications', (req, res) => { res.status(201).json(shelter.submitApplication(req.body.animalId, req.body.applicant, req.body.household)); });
  app.post('/applications/:id/approve', (req, res) => { res.json(shelter.approve(req.params.id)); });
  app.post('/applications/:id/reject', (req, res) => { res.json(shelter.reject(req.params.id)); });
  return app;
}

export function errors(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ShelterError) res.status(STATUS[err.kind]).json({ error: err.message });
  else res.status(500).json({ error: 'internal error' });
}
