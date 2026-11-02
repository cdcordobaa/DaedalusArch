import type { Hire } from '../../../domain/model/Hire';
import type { Hires } from '../../../application/ports/out/Hires';

function dayNumber(date: string): number {
  return Math.floor(Date.parse(date + 'T00:00:00Z') / 86400000);
}

export class InMemoryHires implements Hires {
  private readonly rows = new Map<string, Hire>();

  async save(hire: Hire): Promise<void> {
    this.rows.set(hire.hireId, hire);
  }

  async saveIfBoatFree(hire: Hire): Promise<boolean> {
    const start = dayNumber(hire.from);
    const end = start + hire.nights;
    for (const other of this.rows.values()) {
      if (other.boatId !== hire.boatId || other.hireId === hire.hireId) continue;
      const s = dayNumber(other.from);
      if (start < s + other.nights && s < end) return false;
    }
    this.rows.set(hire.hireId, hire);
    return true;
  }

  async get(hireId: string): Promise<Hire | null> {
    return this.rows.get(hireId) ?? null;
  }
}
