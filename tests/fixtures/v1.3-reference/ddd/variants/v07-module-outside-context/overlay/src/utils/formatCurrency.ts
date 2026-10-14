// VIOLATION (bounded contexts are the top-level modules): an undeclared top-level module.
export function formatCurrency(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}
