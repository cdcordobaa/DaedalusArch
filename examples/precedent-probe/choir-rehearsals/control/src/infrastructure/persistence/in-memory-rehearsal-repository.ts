import type { Rehearsal } from '../../domain/rehearsal';
import type { RehearsalRepository } from '../../domain/rehearsal-repository';

export class InMemoryRehearsalRepository implements RehearsalRepository {
  private readonly rows = new Map<string, Rehearsal>();

  async findById(id: string): Promise<Rehearsal | undefined> {
    return this.rows.get(id);
  }

  async findAll(): Promise<Rehearsal[]> {
    return [...this.rows.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  async save(rehearsal: Rehearsal): Promise<void> {
    this.rows.set(rehearsal.id, rehearsal);
  }
}
