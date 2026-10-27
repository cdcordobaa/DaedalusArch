import { PalletRepository } from '../domain/pallet/PalletRepository';

export class LoadingService {
  constructor(private pallets: PalletRepository) {}
  load(palletId: string, crateKg: number): void {
    const p = this.pallets.find(palletId);
    if (!p) throw new Error('unknown pallet');
    p.addCrate(crateKg);
    this.pallets.save(p);
  }
}
