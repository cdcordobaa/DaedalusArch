import type { FlightPermit } from '../domain/permit/FlightPermit';

export class PermitCsvExporter {
  toCsv(permits: FlightPermit[]): string {
    const rows = permits.map((p) => `${p.id},${p.surveyId},${p.status},${p.reference ?? ''}`);
    return ['id,survey,status,reference', ...rows].join('\n');
  }
}
