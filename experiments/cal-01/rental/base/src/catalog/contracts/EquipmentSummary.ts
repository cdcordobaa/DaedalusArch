export interface EquipmentSummary {
  readonly id: string;
  readonly name: string;
  readonly available: boolean;
  readonly dailyRateCents: number;
  readonly currency: string;
}
