export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  bestBefore: string; // YYYY-MM-DD
}

export function isExpired(item: InventoryItem, today: string): boolean {
  return item.bestBefore < today;
}

export function takeFrom(item: InventoryItem, quantity: number, today: string): InventoryItem {
  if (quantity <= 0) throw new Error('quantity must be positive');
  if (isExpired(item, today)) throw new Error(`${item.name} is past its best-before date`);
  if (item.quantity < quantity) throw new Error(`Only ${item.quantity} of ${item.name} left`);
  return { ...item, quantity: item.quantity - quantity };
}
