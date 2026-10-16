export class Item {
  sku: string;
  description: string;
  unitWeightGrams: number;
  reorderLevel: number;

  constructor(sku: string, description: string, unitWeightGrams: number, reorderLevel: number) {
    this.sku = sku;
    this.description = description;
    this.unitWeightGrams = unitWeightGrams;
    this.reorderLevel = reorderLevel;
  }

  needsReorder(onHand: number): boolean {
    return onHand <= this.reorderLevel;
  }
}
