import { CatalogService } from "../../catalog";
import { Money } from "../../shared-kernel/Money";
import { EquipmentInfo, EquipmentLookup } from "../application/EquipmentLookup";

export class CatalogAcl implements EquipmentLookup {
  constructor(private readonly catalog: CatalogService) {}

  async find(equipmentId: string): Promise<EquipmentInfo | undefined> {
    const summary = await this.catalog.getSummary(equipmentId);
    if (!summary) return undefined;
    return {
      id: summary.id,
      available: summary.available,
      dailyRate: Money.of(summary.dailyRateCents, summary.currency),
    };
  }
}
