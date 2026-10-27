import type { MeterRepositoryPort } from "../../../application/ports/out/meter-repository.port";
import type { Meter } from "../../../domain/meter";

export class InMemoryMeterRepository implements MeterRepositoryPort {
  private readonly items = new Map<string, Meter>();

  constructor(seed: readonly Meter[] = []) {
    for (const meter of seed) {
      this.items.set(meter.id, meter);
    }
  }

  async find(id: string): Promise<Meter | undefined> {
    return this.items.get(id);
  }

  async save(meter: Meter): Promise<void> {
    this.items.set(meter.id, meter);
  }

  async saveAll(meters: readonly Meter[]): Promise<void> {
    for (const meter of meters) {
      this.items.set(meter.id, meter);
    }
  }
}
