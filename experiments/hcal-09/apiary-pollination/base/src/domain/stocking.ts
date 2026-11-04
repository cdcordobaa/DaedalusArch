import { CropKind } from './crop';

const HIVES_PER_HECTARE: Record<CropKind, number> = { almond: 5, apple: 2.5, blueberry: 4, canola: 1.5 };

/** Colonies a grower needs for a bloom, by the apiary's stocking table. */
export function hivesNeeded(crop: CropKind, hectares: number): number {
  return Math.ceil(hectares * HIVES_PER_HECTARE[crop]);
}

/** Monitoring promise to growers: one sensor for every four hives, and never fewer than two in a yard. */
export function sensorUnitsFor(hiveCount: number): number {
  return Math.max(2, Math.ceil(hiveCount / 4));
}
