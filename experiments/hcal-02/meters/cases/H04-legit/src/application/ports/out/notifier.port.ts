import type { Money } from "../../../domain/money";

export interface NotifierPort {
  notifyHighUsage(meterId: string, projectedKwh: number): Promise<void>;
  notifyEstimate(meterId: string, cost: Money): Promise<void>;
}
