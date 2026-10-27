export interface DishView {
  id: string;
  name: string;
  price: string;
  allergens: string[];
}

export interface Menu {
  addDish(name: string, pence: unknown, allergens: readonly string[]): DishView;
}
