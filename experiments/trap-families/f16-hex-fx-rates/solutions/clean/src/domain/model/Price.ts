/** An amount in a currency, as shown to the shopper. */
export interface Price {
  readonly currency: string;
  readonly amount: number;
}

/** Why a price cannot be shown in a currency, for the shopper. */
export const PRICE_NOT_AVAILABLE = 'Prices in this currency are not available right now.';
