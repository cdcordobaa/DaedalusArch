import { BillingEstimator } from "../domain/billing-estimator";
import { MeterNotFoundError, TariffNotFoundError } from "../domain/errors";
import type { EstimateBillPort, EstimateBillQuery, EstimateBillResult } from "./ports/in/estimate-bill.port";
import type { MeterRepositoryPort } from "./ports/out/meter-repository.port";
import type { NotifierPort } from "./ports/out/notifier.port";
import type { TariffRepositoryPort } from "./ports/out/tariff-repository.port";

export class EstimateBillUseCase implements EstimateBillPort {
  private readonly estimator = new BillingEstimator();

  constructor(
    private readonly meters: MeterRepositoryPort,
    private readonly tariffs: TariffRepositoryPort,
    /** Port; the email adapter under adapters/out/notifier/email.notifier implements it. */
    private readonly emailNotifier: NotifierPort,
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
      await this.emailNotifier.notifyHighUsage(meter.id, estimate.projected.value);
    }
    return {
      projectedKwh: estimate.projected.value,
      cents: estimate.cost.cents,
      currency: estimate.cost.currency,
      level: estimate.level,
    };
  }
}
