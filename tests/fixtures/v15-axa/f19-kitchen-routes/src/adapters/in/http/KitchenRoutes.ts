import type { Menu } from '../../../application/ports/in/Menu';
import { reply, type Reply } from '../shared/reply';

/** The kitchen's screen: dishes added for the day. */
export class KitchenRoutes {
  constructor(private readonly menu: Menu) {}

  addDish(name: string, pence: unknown, allergens: readonly string[]): Reply {
    return reply(() => this.menu.addDish(name, pence, allergens));
  }
}
