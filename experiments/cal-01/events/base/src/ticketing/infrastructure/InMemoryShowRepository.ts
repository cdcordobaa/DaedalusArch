import { Show } from "../domain/show/Show";
import { ShowRepository } from "../application/ports";

export class InMemoryShowRepository implements ShowRepository {
  private readonly items = new Map<string, Show>();

  save(show: Show): void {
    this.items.set(show.id, show);
  }

  findById(id: string): Show | undefined {
    return this.items.get(id);
  }
}
