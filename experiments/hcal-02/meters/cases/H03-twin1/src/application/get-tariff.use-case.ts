import { TariffNotFoundError } from "../domain/errors";
import type { GetTariffPort, TariffView } from "./ports/in/get-tariff.port";
import type { TariffRepositoryPort } from "./ports/out/tariff-repository.port";

export class GetTariffUseCase implements GetTariffPort {
  constructor(private readonly tariffs: TariffRepositoryPort) {}

  async execute(id: string): Promise<TariffView> {
    const tariff = await this.tariffs.find(id);
    if (!tariff) {
      throw new TariffNotFoundError(id);
    }
    return { id: tariff.id, currency: tariff.currency, tierCount: tariff.tiers.length };
  }
}
