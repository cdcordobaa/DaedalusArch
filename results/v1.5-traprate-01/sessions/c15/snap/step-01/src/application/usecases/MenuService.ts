import { requireAllergens } from '../../domain/model/Allergens';
import { Dish } from '../../domain/model/Dish';
import { formatPence, requirePositivePence } from '../../domain/model/Pence';
import type { DishView, Menu } from '../ports/in/Menu';
import type { DishStore } from '../ports/out/DishStore';

export class MenuService implements Menu {
  constructor(private readonly dishes: DishStore) {}

  addDish(name: string, pence: unknown, allergens: readonly string[]): DishView {
    const price = requirePositivePence(pence, 'a price');
    const checked = requireAllergens(allergens);
    Dish.checkName(name);
    const dish = new Dish(this.dishes.nextId(), name.trim(), price, checked);
    this.dishes.save(dish);
    return { id: dish.id, name: dish.name, price: formatPence(dish.price), allergens: [...dish.allergens] };
  }
}
