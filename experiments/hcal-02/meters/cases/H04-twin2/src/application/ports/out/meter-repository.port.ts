import type { Meter } from "../../../domain/meter";

export interface MeterRepositoryPort {
  find(id: string): Promise<Meter | undefined>;
  save(meter: Meter): Promise<void>;
  saveAll(meters: readonly Meter[]): Promise<void>;
}
