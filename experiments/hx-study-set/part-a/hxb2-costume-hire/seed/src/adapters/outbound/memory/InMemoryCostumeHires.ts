import type { CostumeHire } from '../../../domain/model/CostumeHire';
import type { CostumeHires } from '../../../application/ports/out/CostumeHires';

export class InMemoryCostumeHires implements CostumeHires {
  private readonly rows = new Map<string, CostumeHire>();

  async save(hire: CostumeHire): Promise<void> {
    this.rows.set(hire.hireId, hire);
  }

  async get(hireId: string): Promise<CostumeHire | null> {
    return this.rows.get(hireId) ?? null;
  }
}
