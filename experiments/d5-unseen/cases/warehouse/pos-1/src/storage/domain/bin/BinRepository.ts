import { Bin } from './Bin';

export interface BinRepository {
  find(id: string): Bin | undefined;
  save(bin: Bin): void;
}
