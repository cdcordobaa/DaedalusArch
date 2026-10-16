export type WorkOrderStatus = 'open' | 'waiting-for-parts' | 'done';

export interface QuotedPart {
  readonly sku: string;
  readonly description: string;
  readonly priceCents: number;
}

export interface WorkOrder {
  readonly id: string;
  readonly customerName: string;
  readonly bike: string;
  readonly problem: string;
  readonly openedAt: Date;
  status: WorkOrderStatus;
  quote?: Quote;
}

export interface Quote {
  readonly parts: readonly QuotedPart[];
  readonly labourCents: number;
  readonly quotedAt: Date;
}

export function quoteTotal(quote: Quote): number {
  return quote.labourCents + quote.parts.reduce((sum, p) => sum + p.priceCents, 0);
}
