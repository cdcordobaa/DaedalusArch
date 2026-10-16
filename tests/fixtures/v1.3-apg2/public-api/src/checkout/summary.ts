// PA3: a type-only deep import is still a deep import (the dependency exists at compile time).
import type { OrderRow } from '../orders/internal/order-row';
export function summarize(rows: OrderRow[]): number {
  return rows.reduce((s, r) => s + r.cents, 0);
}
