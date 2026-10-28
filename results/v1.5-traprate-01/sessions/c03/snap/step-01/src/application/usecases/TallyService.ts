import { requireDate } from '../../domain/model/SchoolDate';
import type { Tally, TallyLine } from '../ports/in/Tally';
import type { DishStore } from '../ports/out/DishStore';
import type { OrderStore } from '../ports/out/OrderStore';
import type { PupilStore } from '../ports/out/PupilStore';

export class TallyService implements Tally {
  constructor(
    private readonly orders: OrderStore,
    private readonly pupils: PupilStore,
    private readonly dishes: DishStore,
  ) {}

  /** Most portions first, then by dish name. */
  tally(date: unknown): TallyLine[] {
    const day = requireDate(date);
    const lines = new Map<string, TallyLine>();
    for (const o of this.orders.onDate(day)) {
      const dish = this.dishes.byId(o.dishId);
      if (dish === null) continue;
      let line = lines.get(dish.id);
      if (line === undefined) {
        line = { dish: dish.name, portions: 0, labelled: 0 };
        lines.set(dish.id, line);
      }
      line.portions += 1;
      if (this.pupils.byId(o.pupilId)?.hasAllergies()) line.labelled += 1;
    }
    return [...lines.values()].sort((a, b) => b.portions - a.portions || (a.dish < b.dish ? -1 : a.dish > b.dish ? 1 : 0));
  }
}
