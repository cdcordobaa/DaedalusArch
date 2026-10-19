export async function renderOrders(): Promise<string> {
  const m = await import('../persistence/order-store');
  return new m.OrderStore().all().join(', ');
}
