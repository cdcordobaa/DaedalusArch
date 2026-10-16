import express, { NextFunction, Request, Response } from 'express';
import { GardenService } from '../../application/garden-service';
import { WaterService } from '../../application/water-service';
import { WorkDayService } from '../../application/work-day-service';
import { DashboardService } from '../../application/dashboard-service';

export function createApp(
  garden: GardenService,
  water: WaterService,
  workDays: WorkDayService,
  dashboard: DashboardService,
): express.Express {
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
  app.post('/meters', (req, res) => {
    water.linkMeter(String(req.body.meterId), Number(req.body.plotNumber));
    res.sendStatus(204);
  });
  app.get('/plots/:number/water', (req, res) => {
    res.json(water.weeklyUseForPlot(Number(req.params.number)));
  });
  // AquaTick webhook
  app.post('/webhooks/aquatick', (req, res) => {
    const { meterId, litres, time } = req.body as { meterId: string; litres: number; time: string };
    res.status(201).json(water.recordReading(meterId, Number(litres), time));
  });
  app.post('/work-days', (req, res) => {
    res.status(201).json(workDays.schedule(req.body.date, req.body.description ?? ''));
  });
  app.get('/work-days', (_req, res) => {
    res.json(workDays.list());
  });
  app.post('/work-days/:id/sign-ups', (req, res) => {
    res.json(workDays.signUp(req.params.id, req.body.gardenerId));
  });
  app.post('/work-days/:id/present', (req, res) => {
    res.json(workDays.markPresent(req.params.id, req.body.gardenerId));
  });
  app.get('/dashboard', (_req, res) => {
    res.json(dashboard.build());
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(400).json({ error: err.message });
  });
  return app;
}
