import { Bin } from '../domain/bin/Bin';
import { BinRepository } from '../domain/bin/BinRepository';
import { Pallet } from '../domain/pallet/Pallet';
import { PalletRepository } from '../domain/pallet/PalletRepository';

export class InMemoryBinRepository implements BinRepository {
  private rows = new Map<string, Bin>();
  find(id: string): Bin | undefined {
    return this.rows.get(id);
  }
  save(bin: Bin): void {
    this.rows.set(bin.id, bin);
  }
}

export class InMemoryPalletRepository implements PalletRepository {
  private rows = new Map<string, Pallet>();
  find(id: string): Pallet | undefined {
    return this.rows.get(id);
  }
  save(p: Pallet): void {
    this.rows.set(p.id, p);
  }
}
