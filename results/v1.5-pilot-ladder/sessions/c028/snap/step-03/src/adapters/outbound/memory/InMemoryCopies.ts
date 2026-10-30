import type { Copy } from '../../../domain/model/Copy';
import type { Copies } from '../../../application/ports/out/storage/Copies';

export class InMemoryCopies implements Copies {
  private readonly rows = new Map<string, Copy>();

  async save(copy: Copy): Promise<void> {
    this.rows.set(copy.copyId, copy);
  }

  async get(copyId: string): Promise<Copy | null> {
    return this.rows.get(copyId) ?? null;
  }
}
