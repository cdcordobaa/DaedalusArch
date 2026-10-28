import { ConditionReport } from '../../../domain/condition-report';
import { HttpResponse } from './loan.dto';

export class ConditionReportController {
  async submit(body: ConditionReport): Promise<HttpResponse<{ artworkId: string }>> {
    return { status: 201, body: { artworkId: body.artworkId } };
  }
}
