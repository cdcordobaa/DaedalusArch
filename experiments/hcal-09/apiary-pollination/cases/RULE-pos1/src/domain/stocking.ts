import { CropKind } from './crop';

const HIVES_PER_HECTARE: Record<CropKind, number> = { almond: 5, apple: 2.5, blueberry: 4, canola: 1.5 };

/** Colonies a grower needs for a bloom, by the apiary's stocking table. */
export function hivesNeeded(crop: CropKind, hectares: number): number {
  return Math.ceil(hectares * HIVES_PER_HECTARE[crop]);
}
