import { readFileSync } from 'node:fs';
import { ConditionReportRepository } from '../../../application/ports/out/condition-report-repository.port';
import { ConditionReport } from '../../../domain/condition-report';

interface ReportRow {
  artworkId: string;
  grade: 'good' | 'fair' | 'poor';
  notes: string;
}

export class FileConditionReportRepository implements ConditionReportRepository {
  constructor(private readonly path: string) {}

  async latestFor(artworkId: string): Promise<ConditionReport | null> {
    const rows = JSON.parse(readFileSync(this.path, 'utf8')) as ReportRow[];
    const row = rows.find((r) => r.artworkId === artworkId);
    return row ? new ConditionReport(row.artworkId, row.grade, row.notes) : null;
  }
}
