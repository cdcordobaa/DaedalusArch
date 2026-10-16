import { Router } from 'express';
import { InMemoryAllocationRepository, InMemoryPlotRepository } from '../outbound/in-memory';
export function dashboardRoutes(plots: InMemoryPlotRepository, allocations: InMemoryAllocationRepository): Router {
  const r = Router();
  r.get('/dashboard', (_req, res) => {
    res.json(plots.all().map((p) => ({ plot: p.number, allocation: allocations.active().find((a) => a.plotNumber === p.number) })));
  });
  return r;
}
