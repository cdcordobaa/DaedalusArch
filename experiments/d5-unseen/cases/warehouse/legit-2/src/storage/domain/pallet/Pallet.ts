export class Pallet {
  private loadKg = 0;
  constructor(readonly id: string, readonly maxWeightKg: number) {}
  get weightKg(): number {
    return this.loadKg;
  }
  addCrate(crateKg: number): void {
    const next = this.loadKg + crateKg;
    if (next > this.maxWeightKg) {
      throw new Error('over the pallet limit');
    }
    this.loadKg = next;
  }
}
