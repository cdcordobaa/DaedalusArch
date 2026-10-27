import type { DeliveryJob } from '../../../domain/DeliveryJob';

export interface JobLedger {
  nextId(): string;
  save(job: DeliveryJob): void;
  find(id: string): DeliveryJob | undefined;
  list(): DeliveryJob[];
}
