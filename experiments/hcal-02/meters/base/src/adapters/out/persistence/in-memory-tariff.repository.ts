import type { TariffRepositoryPort } from "../../../application/ports/out/tariff-repository.port";
import type { Tariff } from "../../../domain/tariff";

export class InMemoryTariffRepository implements TariffRepositoryPort {
  private readonly items = new Map<string, Tariff>();

  constructor(seed: readonly Tariff[] = []) {
    for (const tariff of seed) {
      this.items.set(tariff.id, tariff);
    }
  }

  async find(id: string): Promise<Tariff | undefined> {
    return this.items.get(id);
  }
}
