import { ConditionReport } from '../../../domain/condition-report';
import { HttpResponse } from './loan.dto';

export interface ConditionReportBody {
  artworkId: string;
  grade: 'good' | 'fair' | 'poor';
  notes: string;
}

export class ConditionReportController {
  async submit(body: ConditionReportBody): Promise<HttpResponse<{ artworkId: string }>> {
    const report = new ConditionReport(body.artworkId, body.grade, body.notes);
    return { status: 201, body: { artworkId: report.artworkId } };
  }
}
