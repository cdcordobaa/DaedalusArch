import { BinRepository } from '../domain/bin/BinRepository';
import { PalletRepository } from '../domain/pallet/PalletRepository';

export class PutAwayService {
  constructor(
    private bins: BinRepository,
    private pallets: PalletRepository,
  ) {}

  putAway(binId: string, sku: string, quantity: number): void {
    const bin = this.bins.find(binId);
    if (!bin) throw new Error('unknown bin');
    const used = bin.list().reduce((s, l) => s + l.quantity, 0);
    if (used + quantity > bin.capacity) {
      throw new Error('bin is full');
    }
    bin.put({ id: binId + '/' + sku + '/' + bin.list().length, binId, sku, quantity });
    this.bins.save(bin);
  }

  loadCrate(palletId: string, crateKg: number): void {
    const pallet = this.pallets.find(palletId);
    if (!pallet) throw new Error('unknown pallet');
    pallet.addCrate(crateKg);
    this.pallets.save(pallet);
  }
}
