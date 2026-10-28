import { ProductKind } from './case-order';

export interface Invoice {
  readonly orderId: string;
  readonly amountCents: number;
}

const UNIT_PRICE_CENTS: Record<ProductKind, number> = { crown: 18000, aligner: 9500 };

export class InvoicePricing {
  price(orderId: string, product: ProductKind, teeth: readonly number[]): Invoice {
    const units = product === 'crown' ? teeth.length : 1;
    return { orderId, amountCents: UNIT_PRICE_CENTS[product] * units };
  }
}
