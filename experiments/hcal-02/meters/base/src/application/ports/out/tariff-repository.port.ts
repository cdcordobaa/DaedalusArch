import type { Tariff } from "../../../domain/tariff";

export interface TariffRepositoryPort {
  find(id: string): Promise<Tariff | undefined>;
}
