import { BillingEstimator } from "../domain/billing-estimator";
import { MeterNotFoundError, TariffNotFoundError } from "../domain/errors";
import type { EstimateBillPort, EstimateBillQuery, EstimateBillResult } from "./ports/in/estimate-bill.port";
import type { MeterRepositoryPort } from "./ports/out/meter-repository.port";
import type { NotifierPort } from "./ports/out/notifier.port";
import type { TariffRepositoryPort } from "./ports/out/tariff-repository.port";

export class EstimateBillUseCase implements EstimateBillPort {
  constructor(
    private readonly meters: MeterRepositoryPort,
    private readonly tariffs: TariffRepositoryPort,
    private readonly notifier: NotifierPort,
    private readonly estimator: BillingEstimator = new BillingEstimator(),
  ) {}

  async execute(query: EstimateBillQuery): Promise<EstimateBillResult> {
    const meter = await this.meters.find(query.meterId);
    if (!meter) {
      throw new MeterNotFoundError(query.meterId);
    }
    const tariff = await this.tariffs.find(meter.tariffId);
    if (!tariff) {
      throw new TariffNotFoundError(meter.tariffId);
    }
    const estimate = this.estimator.estimate(meter, tariff, query.days);
    if (estimate.level === "high") {
      await this.notifier.notifyHighUsage(meter.id, estimate.projected.value);
    }
    return {
      projectedKwh: estimate.projected.value,
      cents: estimate.cost.cents,
      currency: estimate.cost.currency,
      level: estimate.level,
    };
  }
}
