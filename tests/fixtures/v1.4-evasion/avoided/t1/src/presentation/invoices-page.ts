export async function countOrders(): Promise<number> {
  const m = await import('../persistence/order-store');
  return new m.OrderStore().all().length;
}
