/** An amount in minor units (cents) to avoid floating-point rounding. */
export interface Money {
  readonly cents: number;
  readonly currency: string;
}

/** "80.00" */
export function formatAmount(money: Money): string {
  return (money.cents / 100).toFixed(2);
}

/** "EUR 80.00" */
export function formatMoney(money: Money): string {
  return `${money.currency} ${formatAmount(money)}`;
}
