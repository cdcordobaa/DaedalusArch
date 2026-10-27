import { Pallet } from './Pallet';

export interface PalletRepository {
  find(id: string): Pallet | undefined;
  save(p: Pallet): void;
}
