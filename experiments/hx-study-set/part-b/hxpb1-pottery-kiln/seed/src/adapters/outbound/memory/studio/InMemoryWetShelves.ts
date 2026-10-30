import type { WetShelf } from '../../../../domain/model/studio/WetShelf';
import type { WetShelves } from '../../../../application/ports/out/studio/WetShelves';

export class InMemoryWetShelves implements WetShelves {
  private readonly shelves: WetShelf[];

  constructor(count = 12) {
    this.shelves = Array.from({ length: count }, (_, i) => ({ shelf: i + 1, memberId: null }));
  }

  async list(): Promise<readonly WetShelf[]> {
    return this.shelves.slice();
  }

  async set(shelf: WetShelf): Promise<void> {
    const i = this.shelves.findIndex((s) => s.shelf === shelf.shelf);
    if (i >= 0) this.shelves[i] = shelf;
  }
}
