import { Pallet } from '../domain/pallet/Pallet';
import { PalletRepository } from '../domain/pallet/PalletRepository';

export class InMemoryPalletRepository implements PalletRepository {
  private rows = new Map<string, Pallet>();
  find(id: string): Pallet | undefined {
    return this.rows.get(id);
  }
  save(p: Pallet): void {
    this.rows.set(p.id, p);
  }
}
