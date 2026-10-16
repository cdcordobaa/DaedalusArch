import { Express } from 'express';
import { Fostering } from '../../../application/fostering';

export function fosterRoutes(app: Express, fostering: Fostering): void {
  app.post('/carers', (req, res) => { res.status(201).json(fostering.signUp(req.body)); });
  app.get('/carers', (_req, res) => { res.json(fostering.listCarers()); });
  app.post('/placements', (req, res) => { res.status(201).json(fostering.place(req.body.animalId, req.body.carerId)); });
  app.post('/placements/:id/end', (req, res) => { res.json(fostering.end(req.params.id)); });
}
