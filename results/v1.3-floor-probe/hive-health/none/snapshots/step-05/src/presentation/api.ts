import { NextFunction, Request, Response, Router } from 'express';
import { ApiaryService } from '../business/apiary-service';
import { DomainError } from '../business/model';
import { ScaleService } from '../business/scale-service';
import { TreatmentService } from '../business/treatment-service';
import { ReportService } from '../business/report-service';

function memberId(req: Request): string {
  const id = req.header('x-member-id');
  if (!id) throw new DomainError('x-member-id header is required', 401);
  return id;
}

export function apiRouter(apiaries: ApiaryService, scales: ScaleService, treatments: TreatmentService, reports: ReportService): Router {
  const r = Router();
  r.post('/members', (req, res) => {
    res.status(201).json(apiaries.registerMember(req.body.name, req.body.phone));
  });
  r.post('/apiaries', (req, res) => {
    res.status(201).json(apiaries.registerApiary(memberId(req), req.body.name, req.body.region));
  });
  r.post('/apiaries/:id/hives', (req, res) => {
    res.status(201).json(apiaries.addHive(memberId(req), req.params.id, req.body.label));
  });
  r.get('/apiaries/:id/hives', (req, res) => {
    res.json(apiaries.hivesInApiary(req.params.id));
  });
  r.get('/hives/flagged', (_req, res) => {
    res.json(apiaries.flaggedHives());
  });
  r.get('/hives/:id', (req, res) => {
    res.json(apiaries.hiveView(req.params.id));
  });
  r.post('/hives/:id/inspections', (req, res) => {
    const b = req.body;
    res.status(201).json(
      apiaries.recordInspection(memberId(req), req.params.id, {
        date: String(b.date),
        queenSeen: !!b.queenSeen,
        broodFrames: Number(b.broodFrames),
        temperament: Number(b.temperament),
        varroaPer100: Number(b.varroaPer100),
      }),
    );
  });
  r.get('/hives/:id/inspections', (req, res) => {
    res.json(apiaries.inspectionsOf(req.params.id));
  });
  r.post('/hives/:id/scale', (req, res) => {
    scales.linkScale(memberId(req), String(req.body.serial), req.params.id);
    res.sendStatus(204);
  });
  // BuzzScale webhook
  r.post('/webhooks/buzzscale', async (req, res) => {
    const { serial, kg, time } = req.body as { serial: string; kg: number; time: string };
    res.status(201).json(await scales.recordReading(String(serial), Number(kg), String(time)));
  });
  r.post('/products', (req, res) => {
    res.status(201).json(treatments.defineProduct(req.body.name, Number(req.body.withdrawalDays)));
  });
  r.get('/products', (_req, res) => {
    res.json(treatments.listProducts());
  });
  r.post('/hives/:id/treatments', (req, res) => {
    res.status(201).json(treatments.recordTreatment(memberId(req), req.params.id, req.body.product, req.body.startDate, req.body.endDate));
  });
  r.get('/hives/:id/treatments', (req, res) => {
    res.json(treatments.treatmentsOf(req.params.id));
  });
  r.post('/hives/:id/harvests', (req, res) => {
    res.status(201).json(treatments.recordHarvest(memberId(req), req.params.id, req.body.date, Number(req.body.kg)));
  });
  r.get('/hives/:id/harvests', (req, res) => {
    res.json(treatments.harvestsOf(req.params.id));
  });
  // national bee health office
  r.get('/reports/quarterly/:quarter', (req, res) => {
    res.json(reports.quarterly(req.params.quarter));
  });
  return r;
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  res.status(err instanceof DomainError ? err.status : 500).json({ error: err.message });
}
