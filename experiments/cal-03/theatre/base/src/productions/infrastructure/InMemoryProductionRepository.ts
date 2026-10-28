import { Production } from '../domain/production/Production';
import { ProductionRepository } from '../domain/production/ProductionRepository';

export class InMemoryProductionRepository implements ProductionRepository {
  private readonly rows = new Map<string, Production>();

  async findById(id: string): Promise<Production | undefined> {
    return this.rows.get(id);
  }

  async save(production: Production): Promise<void> {
    for (const other of this.rows.values()) {
      if (other.slug === production.slug && other.id !== production.id) {
        throw new Error(`slug ${production.slug} already taken`);
      }
    }
    this.rows.set(production.id, production);
  }
}
