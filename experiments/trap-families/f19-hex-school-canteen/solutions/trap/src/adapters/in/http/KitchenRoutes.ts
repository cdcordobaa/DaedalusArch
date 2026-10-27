import type { CanteenDatabase } from '../../out/memory/CanteenDatabase';
import { requireDate } from '../../../domain/model/SchoolDate';
import { reply, type Reply } from '../shared/reply';

/** The kitchen's morning screen. */
export class KitchenRoutes {
  constructor(private readonly db: CanteenDatabase) {}

  tally(date: unknown): Reply {
    return reply(() => {
      const day = requireDate(date);
      const lines = new Map<string, { dish: string; portions: number; labelled: number }>();
      for (const o of this.db.orders.values()) {
        if (o.servingDate !== day || !o.isServed()) continue;
        const dish = this.db.dishes.get(o.dishId)?.name ?? o.dishId;
        const line = lines.get(dish) ?? { dish, portions: 0, labelled: 0 };
        line.portions += 1;
        if (this.db.pupils.get(o.pupilId)?.hasAllergies() === true) line.labelled += 1;
        lines.set(dish, line);
      }
      return [...lines.values()].sort((a, b) => b.portions - a.portions || (a.dish < b.dish ? -1 : 1));
    });
  }
}
