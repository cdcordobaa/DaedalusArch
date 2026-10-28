import { ConditionReport } from '../../../domain/condition-report';

export interface ConditionReportRepository {
  latestFor(artworkId: string): Promise<ConditionReport | null>;
}
