import type { WaterReading } from '../../../../domain/model/admin/WaterReading';

export interface WaterReadingStore {
  add(item: WaterReading): Promise<void>;
  all(): Promise<WaterReading[]>;
}
