import type { Hire } from '../../../domain/model/Hire';
import type { Hires } from '../../../application/ports/out/Hires';

export class InMemoryHires implements Hires {
  private readonly rows = new Map<string, Hire>();

  async save(hire: Hire): Promise<void> {
    this.rows.set(hire.hireId, hire);
  }

  async saveIfBoatFree(hire: Hire): Promise<boolean> {
    const day = (d: string) => Date.parse(d + 'T00:00:00Z') / 86400000;
    const start = day(hire.from);
    const end = start + hire.nights;
    for (const o of this.rows.values()) {
      if (o.boatId !== hire.boatId || o.hireId === hire.hireId) continue;
      const s = day(o.from);
      if (start < s + o.nights && s < end) return false;
    }
    this.rows.set(hire.hireId, hire);
    return true;
  }

  async get(hireId: string): Promise<Hire | null> {
    return this.rows.get(hireId) ?? null;
  }
}
