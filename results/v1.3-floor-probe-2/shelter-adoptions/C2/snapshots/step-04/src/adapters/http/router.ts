import express, { NextFunction, Request, Response, Router } from 'express';
import { ShelterUseCases } from '../../ports/in/shelter';
import { DomainError } from '../../domain/animal';
import { NotFoundError } from '../../application/shelter-service';

export function shelterRouter(shelter: ShelterUseCases): Router {
  const r = express.Router();
  r.post('/animals', (req, res) => { res.status(201).json(shelter.registerAnimal(req.body, staffId(req))); });
  r.get('/animals', (_req, res) => { res.json(shelter.listAnimals()); });
  r.post('/animals/:id/ready', (req, res) => { res.json(shelter.markReady(req.params.id, staffId(req))); });
  r.get('/animals/:id/applications', (req, res) => { res.json(shelter.applicationsFor(req.params.id)); });
  r.post('/applications', (req, res) => { res.status(201).json(shelter.submitApplication(req.body, staffId(req, 'public'))); });
  r.post('/applications/:id/approve', (req, res) => { res.json(shelter.approve(req.params.id, staffId(req))); });
  r.post('/applications/:id/reject', (req, res) => { res.json(shelter.reject(req.params.id, staffId(req))); });
  return r;
}

/** The acting staff member, from the X-Staff-Id request header. */
export function staffId(req: Request, fallback = 'unknown'): string {
  const h = req.header('x-staff-id');
  return h && h.trim() !== '' ? h.trim() : fallback;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof NotFoundError) { res.status(404).json({ error: err.message }); return; }
  if (err instanceof DomainError) { res.status(409).json({ error: err.message }); return; }
  res.status(500).json({ error: 'internal error' });
}
