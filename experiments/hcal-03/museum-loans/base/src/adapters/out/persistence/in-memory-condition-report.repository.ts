import { ConditionReportRepository } from '../../../application/ports/out/condition-report-repository.port';
import { ConditionReport } from '../../../domain/condition-report';

export class InMemoryConditionReportRepository implements ConditionReportRepository {
  private readonly reports = new Map<string, ConditionReport>();

  seed(report: ConditionReport): void {
    this.reports.set(report.artworkId, report);
  }

  async latestFor(artworkId: string): Promise<ConditionReport | null> {
    return this.reports.get(artworkId) ?? null;
  }
}
