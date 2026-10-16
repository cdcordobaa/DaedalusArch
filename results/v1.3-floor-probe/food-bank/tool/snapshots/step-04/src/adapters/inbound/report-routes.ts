import { Router } from 'express';
import { NetworkReportService, WeeklyReport } from '../../application/network-report-service';

function toCsv(r: WeeklyReport): string {
  const lines = ['section,key,received,handed_out,thrown_away,households'];
  for (const c of r.categories) lines.push(`category,${c.category},${c.received},${c.handedOut},${c.thrownAway},`);
  for (const p of r.householdsByPostcode) lines.push(`postcode,${p.postcode},,,,${p.households}`);
  return lines.join('\n') + '\n';
}

export function reportRoutes(reports: NetworkReportService): Router {
  const r = Router();
  r.get('/reports/weekly.csv', (req, res) => {
    const from = typeof req.query.from === 'string' ? req.query.from : new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    res.type('text/csv').send(toCsv(reports.weekly(from)));
  });
  return r;
}
