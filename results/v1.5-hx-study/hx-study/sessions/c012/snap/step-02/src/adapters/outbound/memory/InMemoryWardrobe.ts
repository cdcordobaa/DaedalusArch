import type { Costume } from '../../../domain/model/Costume';
import type { Wardrobe } from '../../../application/ports/out/Wardrobe';

/** The wardrobe's stock list. */
export class InMemoryWardrobe implements Wardrobe {
  private readonly rows = new Map<string, Costume>([
    ['C-ROBE', { costumeId: 'C-ROBE', name: 'Friar robe', fabric: 'wool', dayRate: 12 }],
    ['C-GOWN', { costumeId: 'C-GOWN', name: 'Court gown', fabric: 'silk', dayRate: 30 }],
    ['C-CAPE', { costumeId: 'C-CAPE', name: 'Royal cape', fabric: 'velvet', dayRate: 25 }],
    ['C-COAT', { costumeId: 'C-COAT', name: 'Sailor coat', fabric: 'cotton', dayRate: 9 }],
  ]);

  async costume(costumeId: string): Promise<Costume | null> {
    return this.rows.get(costumeId) ?? null;
  }
}
