import type { EstimateBillPort } from "../../../application/ports/in/estimate-bill.port";
import { toHttp } from "./http-errors";
import type { HttpResponse } from "./http-errors";

export class BillController {
  constructor(private readonly estimateBill: EstimateBillPort) {}

  async get(meterId: string, days: number): Promise<HttpResponse> {
    try {
      const result = await this.estimateBill.execute({ meterId, days });
      const surchargeCents = result.projectedKwh > 500 ? Math.round(result.cents * 0.05) : 0;
      const total = result.cents + surchargeCents;
      return { status: 200, body: { ...result, cents: total, level: total > 15000 ? "high" : result.level } };
    } catch (error) {
      return toHttp(error);
    }
  }
}
