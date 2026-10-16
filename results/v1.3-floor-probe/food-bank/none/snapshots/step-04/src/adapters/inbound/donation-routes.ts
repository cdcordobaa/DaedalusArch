import { Router } from 'express';
import { DonationImportService } from '../../application/donation-import-service';

export function donationRoutes(service: DonationImportService): Router {
  const r = Router();
  r.put('/category-mappings/:productCode', (req, res) => {
    service.setMapping(req.params.productCode, req.body.category);
    res.sendStatus(204);
  });
  r.get('/category-mappings', (_req, res) => {
    res.json(service.listMappings());
  });
  // manual trigger, for staff
  r.post('/donations/import', async (_req, res) => {
    res.json(await service.importYesterday());
  });
  return r;
}
