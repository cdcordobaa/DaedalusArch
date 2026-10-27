import type { Transaction } from "knex";
import type { Meter } from "../../../domain/meter";

export interface MeterRepositoryPort {
  find(id: string): Promise<Meter | undefined>;
  save(meter: Meter): Promise<void>;
  saveWithin(meter: Meter, trx: Transaction): Promise<void>;
}
