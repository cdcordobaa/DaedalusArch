import type { Hire } from '../../../domain/model/Hire';
import type { Hires } from '../../../application/ports/out/Hires';

export class InMemoryHires implements Hires {
  private readonly rows = new Map<string, Hire>();

  async save(hire: Hire): Promise<void> {
    this.rows.set(hire.hireId, hire);
  }

  async saveIfBoatFree(hire: Hire): Promise<boolean> {
    const [start, end] = nightsOf(hire);
    for (const o of this.rows.values()) {
      if (o.boatId !== hire.boatId || o.hireId === hire.hireId) continue;
      const [s, e] = nightsOf(o);
      if (start < e && s < end) return false;
    }
    this.rows.set(hire.hireId, hire);
    return true;
  }

  async get(hireId: string): Promise<Hire | null> {
    return this.rows.get(hireId) ?? null;
  }
}

/** Half-open range of day numbers: [first night, morning of return). */
function nightsOf(h: Hire): [number, number] {
  const [y, m, d] = h.from.split('-').map(Number);
  const start = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return [start, start + h.nights];
}
