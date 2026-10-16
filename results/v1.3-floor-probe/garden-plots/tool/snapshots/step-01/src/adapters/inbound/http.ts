import express, { NextFunction, Request, Response } from 'express';
import { GardenService } from '../../application/garden-service';

export function createApp(garden: GardenService): express.Express {
  const app = express();
  app.use(express.json());

  app.post('/plots', (req, res) => {
    res.status(201).json(garden.definePlot({ number: Number(req.body.number), sizeM2: Number(req.body.sizeM2), raisedBed: !!req.body.raisedBed }));
  });
  app.get('/plots', (_req, res) => {
    res.json(garden.listPlots());
  });
  app.get('/plots/free', (_req, res) => {
    res.json(garden.freePlots());
  });
  app.post('/applications', (req, res) => {
    res.status(201).json(garden.apply(req.body.name, req.body.email));
  });
  app.get('/waiting-list', (_req, res) => {
    res.json(garden.waiting());
  });
  app.post('/plots/:number/allocate', async (req, res) => {
    res.status(201).json(await garden.allocate(Number(req.params.number)));
  });
  app.get('/allocations', (_req, res) => {
    res.json(garden.listAllocations());
  });
  // PayBee webhook
  app.post('/webhooks/paybee', (req, res) => {
    garden.recordPayment(req.body.reference, req.body.status);
    res.sendStatus(204);
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(400).json({ error: err.message });
  });
  return app;
}
