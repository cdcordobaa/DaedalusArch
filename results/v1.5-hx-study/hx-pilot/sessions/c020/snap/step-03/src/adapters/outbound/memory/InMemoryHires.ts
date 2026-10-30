import type { Hire } from '../../../domain/model/Hire';
import type { Hires } from '../../../application/ports/out/Hires';

export class InMemoryHires implements Hires {
  private readonly rows = new Map<string, Hire>();

  async save(hire: Hire): Promise<void> {
    this.rows.set(hire.hireId, hire);
  }

  async saveUnlessConflict(hire: Hire, conflicts: (other: Hire) => boolean): Promise<boolean> {
    const others = [...this.rows.values()].filter((o) => o.boatId === hire.boatId && o.hireId !== hire.hireId);
    if (others.some(conflicts)) return false;
    this.rows.set(hire.hireId, hire);
    return true;
  }

  async get(hireId: string): Promise<Hire | null> {
    return this.rows.get(hireId) ?? null;
  }
}
