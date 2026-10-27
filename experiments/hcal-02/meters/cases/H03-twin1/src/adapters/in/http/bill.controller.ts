import type { EstimateBillPort } from "../../../application/ports/in/estimate-bill.port";
import type { GetTariffPort } from "../../../application/ports/in/get-tariff.port";
import { toHttp } from "./http-errors";
import type { HttpResponse } from "./http-errors";

export class BillController {
  constructor(
    private readonly estimateBill: EstimateBillPort,
    private readonly getTariff: GetTariffPort,
  ) {}

  async get(meterId: string, days: number): Promise<HttpResponse> {
    try {
      const result = await this.estimateBill.execute({ meterId, days });
      return { status: 200, body: result };
    } catch (error) {
      return toHttp(error);
    }
  }

  async tariff(id: string): Promise<HttpResponse> {
    try {
      return { status: 200, body: await this.getTariff.execute(id) };
    } catch (error) {
      return toHttp(error);
    }
  }
}
