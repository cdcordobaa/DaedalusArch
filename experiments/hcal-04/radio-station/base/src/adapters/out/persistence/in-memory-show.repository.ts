import type { ShowRepository } from '../../../application/ports/out/show.repository';
import type { Show } from '../../../domain/show';

export class InMemoryShowRepository implements ShowRepository {
  private readonly items: Show[] = [];

  async save(show: Show): Promise<void> {
    this.items.push(show);
  }

  async findByDay(dayOfWeek: number): Promise<Show[]> {
    return this.items.filter((s) => s.slot.dayOfWeek === dayOfWeek);
  }
}
