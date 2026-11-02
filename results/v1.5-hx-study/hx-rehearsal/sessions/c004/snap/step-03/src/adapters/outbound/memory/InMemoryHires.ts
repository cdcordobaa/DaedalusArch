import type { Hire } from '../../../domain/model/Hire';
import { sharesNights } from '../../../domain/services/HireNights';
import type { Hires } from '../../../application/ports/out/Hires';

export class InMemoryHires implements Hires {
  private readonly rows = new Map<string, Hire>();

  async save(hire: Hire): Promise<void> {
    this.rows.set(hire.hireId, hire);
  }

  async get(hireId: string): Promise<Hire | null> {
    return this.rows.get(hireId) ?? null;
  }

  async saveIfBoatFree(hire: Hire): Promise<boolean> {
    for (const other of this.rows.values()) {
      if (other.hireId !== hire.hireId && other.boatId === hire.boatId && sharesNights(other, hire)) return false;
    }
    this.rows.set(hire.hireId, hire);
    return true;
  }
}
