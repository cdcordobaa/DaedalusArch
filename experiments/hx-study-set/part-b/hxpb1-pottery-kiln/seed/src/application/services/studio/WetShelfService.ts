import { StudioError } from '../../../domain/errors/StudioError';
import type { WetShelves } from '../../ports/out/studio/WetShelves';

/** Hands out damp-room shelves to members. */
export class WetShelfService {
  constructor(private readonly shelves: WetShelves) {}

  async claim(memberId: string): Promise<number> {
    const all = await this.shelves.list();
    if (all.some((s) => s.memberId === memberId)) throw new StudioError(memberId + ' already has a shelf');
    const free = all.find((s) => s.memberId === null);
    if (free === undefined) throw new StudioError('every damp-room shelf is taken');
    await this.shelves.set({ shelf: free.shelf, memberId });
    return free.shelf;
  }

  async release(shelf: number): Promise<void> {
    await this.shelves.set({ shelf, memberId: null });
  }
}
