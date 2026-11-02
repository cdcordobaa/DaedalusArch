import type { Hire } from '../../../domain/model/Hire';
import type { Hires } from '../../../application/ports/out/Hires';

export class InMemoryHires implements Hires {
  private readonly rows = new Map<string, Hire>();

  async save(hire: Hire): Promise<void> {
    this.rows.set(hire.hireId, hire);
  }

  async get(hireId: string): Promise<Hire | null> {
    return this.rows.get(hireId) ?? null;
  }

  async forBoat(boatId: string): Promise<Hire[]> {
    return [...this.rows.values()].filter((h) => h.boatId === boatId);
  }
}
