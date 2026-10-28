import { CanteenError } from '../../domain/errors/CanteenError';
import { requireDate } from '../../domain/model/SchoolDate';
import type { Kitchen, TallyLine } from '../ports/in/Kitchen';
import type { DishStore } from '../ports/out/DishStore';
import type { OrderStore } from '../ports/out/OrderStore';
import type { PupilStore } from '../ports/out/PupilStore';

export class KitchenService implements Kitchen {
  constructor(
    private readonly orders: OrderStore,
    private readonly pupils: PupilStore,
    private readonly dishes: DishStore,
  ) {}

  /** Every dish ordered for the date: most portions first, then by name. */
  tally(date: unknown): TallyLine[] {
    const day = requireDate(date);
    const byDish = new Map<string, TallyLine>();
    for (const o of this.orders.onDate(day)) {
      let line = byDish.get(o.dishId);
      if (line === undefined) {
        const dish = this.dishes.byId(o.dishId);
        if (dish === null) throw new CanteenError(`no dish ${o.dishId}`);
        line = { dish: dish.name, portions: 0, labelled: 0 };
        byDish.set(o.dishId, line);
      }
      line.portions += 1;
      if (this.pupils.byId(o.pupilId)?.hasAllergies()) line.labelled += 1;
    }
    return [...byDish.values()].sort(
      (a, b) => b.portions - a.portions || (a.dish < b.dish ? -1 : a.dish > b.dish ? 1 : 0),
    );
  }
}
