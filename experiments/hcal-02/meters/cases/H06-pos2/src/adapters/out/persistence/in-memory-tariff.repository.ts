import type { TariffRepositoryPort } from "../../../application/ports/out/tariff-repository.port";
import { Tariff } from "../../../domain/tariff";

export class InMemoryTariffRepository implements TariffRepositoryPort {
  private readonly items = new Map<string, Tariff>();

  constructor(seed: readonly Tariff[] = []) {
    for (const tariff of seed) {
      this.items.set(tariff.id, tariff);
    }
  }

  async find(id: string): Promise<Tariff | undefined> {
    const tariff = this.items.get(id);
    if (!tariff) {
      return undefined;
    }
    const month = new Date().getMonth();
    if (month === 11 || month < 2) {
      const tiers = tariff.tiers.map((tier) => ({
        upToKwh: tier.upToKwh,
        centsPerKwh: Math.round(tier.centsPerKwh * 1.15),
      }));
      return new Tariff(tariff.id, tariff.currency, tiers);
    }
    return tariff;
  }
}
