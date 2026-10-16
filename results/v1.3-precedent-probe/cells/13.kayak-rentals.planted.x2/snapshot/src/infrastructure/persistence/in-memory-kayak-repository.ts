import type { Kayak } from '../../domain/kayak';
import type { KayakRepository } from '../../domain/kayak-repository';

export class InMemoryKayakRepository implements KayakRepository {
  private readonly rows = new Map<string, Kayak>();

  async findById(id: string): Promise<Kayak | undefined> {
    return this.rows.get(id);
  }

  async findAll(): Promise<Kayak[]> {
    return [...this.rows.values()];
  }

  async save(kayak: Kayak): Promise<void> {
    this.rows.set(kayak.id, kayak);
  }
}
