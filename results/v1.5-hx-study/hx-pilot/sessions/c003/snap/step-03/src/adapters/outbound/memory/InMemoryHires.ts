import type { Hire } from '../../../domain/model/Hire';
import { sameNights } from '../../../domain/services/HireCalendar';
import type { Hires } from '../../../application/ports/out/Hires';

export class InMemoryHires implements Hires {
  private readonly rows = new Map<string, Hire>();

  async save(hire: Hire): Promise<void> {
    this.rows.set(hire.hireId, hire);
  }

  async saveIfBoatFree(hire: Hire): Promise<boolean> {
    for (const other of this.rows.values()) {
      if (other.hireId !== hire.hireId && other.boatId === hire.boatId && sameNights(other, hire)) return false;
    }
    this.rows.set(hire.hireId, hire);
    return true;
  }

  async get(hireId: string): Promise<Hire | null> {
    return this.rows.get(hireId) ?? null;
  }
}
