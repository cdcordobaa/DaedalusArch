const FREE_SHIPPING_MIN_CENTS = 5000;
const SHIPPING_FEE_CENTS = 499;

export interface InvoiceItem {
  readonly description: string;
  readonly amountCents: number;
}

export interface Invoice {
  readonly items: readonly InvoiceItem[];
  readonly shippingCents: number;
  readonly totalCents: number;
}

export class InvoiceAssembler {
  assemble(items: readonly InvoiceItem[]): Invoice {
    let sum = 0;
    for (const item of items) sum += item.amountCents;
    const shippingCents = !(sum < FREE_SHIPPING_MIN_CENTS) ? 0 : SHIPPING_FEE_CENTS;
    return { items, shippingCents, totalCents: sum + shippingCents };
  }
}
