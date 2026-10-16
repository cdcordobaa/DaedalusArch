import express, { Router } from 'express';
import { FosterUseCases } from '../../ports/in/foster';

export function fosterRouter(foster: FosterUseCases): Router {
  const r = express.Router();
  r.post('/carers', (req, res) => { res.status(201).json(foster.signUp(req.body)); });
  r.get('/carers', (_req, res) => { res.json(foster.listCarers()); });
  r.post('/placements', (req, res) => { res.status(201).json(foster.place(req.body.animalId, req.body.carerId)); });
  r.post('/placements/:id/end', (req, res) => { res.json(foster.endPlacement(req.params.id)); });
  return r;
}
