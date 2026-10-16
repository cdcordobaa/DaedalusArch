import express, { Router } from 'express';
import { AuditQueries } from '../../ports/in/audit';

export function auditRouter(audit: AuditQueries): Router {
  const r = express.Router();
  r.get('/animals/:id/audit', (req, res) => { res.json(audit.trailOfAnimal(req.params.id)); });
  r.get('/staff/:id/changes', (req, res) => {
    const from = String(req.query.from ?? '0000-01-01');
    const to = String(req.query.to ?? '9999-12-31T23:59:59Z');
    res.json(audit.changesBy(req.params.id, from, to));
  });
  return r;
}
