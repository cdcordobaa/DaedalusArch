import { requireDate } from '../../domain/model/SchoolDate';
import type { KitchenTally, TallyLine } from '../ports/in/KitchenTally';
import type { DishStore } from '../ports/out/DishStore';
import type { OrderStore } from '../ports/out/OrderStore';
import type { PupilStore } from '../ports/out/PupilStore';

export class KitchenTallyService implements KitchenTally {
  constructor(private readonly orders: OrderStore, private readonly dishes: DishStore, private readonly pupils: PupilStore) {}

  tally(date: unknown): TallyLine[] {
    const day = requireDate(date);
    const lines = new Map<string, TallyLine>();
    for (const order of this.orders.forDate(day).filter((o) => o.isServed())) {
      const dish = this.dishes.byId(order.dishId)?.name ?? order.dishId;
      const line = lines.get(dish) ?? { dish, portions: 0, labelled: 0 };
      line.portions += 1;
      if (this.pupils.byId(order.pupilId)?.hasAllergies() === true) line.labelled += 1;
      lines.set(dish, line);
    }
    return [...lines.values()].sort((a, b) => b.portions - a.portions || (a.dish < b.dish ? -1 : a.dish > b.dish ? 1 : 0));
  }
}
