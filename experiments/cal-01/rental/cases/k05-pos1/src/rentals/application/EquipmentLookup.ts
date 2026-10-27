import { Money } from "../../shared-kernel/Money";

export interface EquipmentInfo {
  readonly id: string;
  readonly available: boolean;
  readonly dailyRate: Money;
}

export interface EquipmentLookup {
  find(equipmentId: string): Promise<EquipmentInfo | undefined>;
  markRented(equipmentId: string): Promise<void>;
}
