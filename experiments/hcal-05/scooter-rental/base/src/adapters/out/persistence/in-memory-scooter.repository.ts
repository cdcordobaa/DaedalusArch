import { ScooterRepositoryPort } from '../../../application/ports/out/scooter-repository.port';
import { Scooter } from '../../../domain/scooter';

export class InMemoryScooterRepository implements ScooterRepositoryPort {
  private readonly rows = new Map<string, Scooter>();
  async save(scooter: Scooter): Promise<void> { this.rows.set(scooter.id, scooter); }
  async find(id: string): Promise<Scooter | undefined> { return this.rows.get(id); }
}
