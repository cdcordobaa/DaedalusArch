import type { OverdueReportUseCase } from '../../../application/reporting/OverdueReportUseCase';
import { errorResponse } from './http';
import type { HttpRequest, HttpResponse } from './http';

/** GET /reports/overdue?asOf=YYYY-MM-DD */
export class ReportController {
  constructor(private readonly overdueReport: OverdueReportUseCase) {}

  async overdue(req: HttpRequest): Promise<HttpResponse> {
    const asOf = req.query?.asOf;
    if (asOf !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
      return { status: 400, body: { error: 'INVALID_DATE', message: 'asOf must be YYYY-MM-DD' } };
    }
    try {
      const lines = await this.overdueReport.execute(asOf === undefined ? undefined : new Date(`${asOf}T00:00:00Z`));
      return {
        status: 200,
        body: lines.map((l) => ({ ...l, dueAt: l.dueAt.toISOString().slice(0, 10) })),
      };
    } catch (err) {
      return errorResponse(err);
    }
  }
}
