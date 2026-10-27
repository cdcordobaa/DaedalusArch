import type { EstimateBillPort } from "../../../application/ports/in/estimate-bill.port";
import { toHttp } from "./http-errors";
import type { HttpResponse } from "./http-errors";

export class BillController {
  constructor(private readonly estimateBill: EstimateBillPort) {}

  async get(meterId: string, days: number): Promise<HttpResponse> {
    try {
      const result = await this.estimateBill.execute({ meterId, days });
      return { status: 200, body: result };
    } catch (error) {
      return toHttp(error);
    }
  }
}
