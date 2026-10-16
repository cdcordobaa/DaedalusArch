import { Express } from 'express';
import { Audit } from '../../../application/audit';

export function auditRoutes(app: Express, audit: Audit): void {
  app.get('/animals/:id/audit', (req, res) => { res.json(audit.trailOf(req.params.id)); });
  app.get('/audit/by/:staffId', (req, res) => {
    const from = typeof req.query.from === 'string' ? req.query.from : '';
    const to = typeof req.query.to === 'string' ? req.query.to : '9999';
    res.json(audit.changesBy(req.params.staffId, from, to));
  });
}
