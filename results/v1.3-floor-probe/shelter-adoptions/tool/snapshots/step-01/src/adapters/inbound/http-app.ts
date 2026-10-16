import express, { NextFunction, Request, Response } from 'express';
import { AnimalService, NotFoundError } from '../../application/animal-service';
import { AdoptionService } from '../../application/adoption-service';

export interface HttpDeps {
  animals: AnimalService;
  adoptions: AdoptionService;
}

export function createHttpApp(deps: HttpDeps): express.Express {
  const app = express();
  app.use(express.json());

  app.post('/animals', (req, res) => {
    res.status(201).json(deps.animals.register(req.body));
  });
  app.get('/animals', (_req, res) => {
    res.json(deps.animals.list());
  });
  app.get('/animals/:id', (req, res) => {
    res.json(deps.animals.get(req.params.id));
  });
  app.post('/animals/:id/ready', (req, res) => {
    res.json(deps.animals.markReady(req.params.id));
  });
  app.post('/animals/:id/applications', (req, res) => {
    res.status(201).json(deps.adoptions.submit(req.params.id, req.body));
  });
  app.get('/animals/:id/applications', (req, res) => {
    res.json(deps.adoptions.listForAnimal(req.params.id));
  });
  app.post('/applications/:id/approve', (req, res) => {
    res.json(deps.adoptions.approve(req.params.id));
  });
  app.post('/applications/:id/reject', (req, res) => {
    res.json(deps.adoptions.reject(req.params.id));
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    const status = err instanceof NotFoundError ? 404 : 400;
    res.status(status).json({ error: err.message });
  });
  return app;
}
