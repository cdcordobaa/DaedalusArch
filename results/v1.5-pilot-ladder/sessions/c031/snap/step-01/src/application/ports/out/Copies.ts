import type { Copy } from '../../../domain/model/Copy';

export interface Copies {
  save(copy: Copy): Promise<void>;
  get(copyId: string): Promise<Copy | null>;
}
