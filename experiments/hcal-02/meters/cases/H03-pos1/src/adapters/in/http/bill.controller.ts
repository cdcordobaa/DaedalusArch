import type { EstimateBillPort } from "../../../application/ports/in/estimate-bill.port";
import type { InMemoryTariffRepository } from "../../out/persistence/in-memory-tariff.repository";
import { toHttp } from "./http-errors";
import type { HttpResponse } from "./http-errors";

export class BillController {
  constructor(
    private readonly estimateBill: EstimateBillPort,
    private readonly tariffs: InMemoryTariffRepository,
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
    const tariff = await this.tariffs.find(id);
    if (!tariff) {
      return { status: 404, body: { error: "TARIFF_NOT_FOUND" } };
    }
    return { status: 200, body: { id: tariff.id, currency: tariff.currency } };
  }
}
