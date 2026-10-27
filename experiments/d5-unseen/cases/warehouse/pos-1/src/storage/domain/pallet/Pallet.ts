export class Pallet {
  private crates: number[] = [];
  constructor(readonly id: string, readonly maxWeightKg: number) {}
  get weightKg(): number {
    return this.crates.reduce((a, b) => a + b, 0);
  }
  addCrate(crateKg: number): void {
    if (this.weightKg + crateKg > this.maxWeightKg) {
      throw new Error('pallet overweight');
    }
    this.crates.push(crateKg);
  }
}
