import type { Flour } from '../../../domain/model/Flour';

/** The flour wholesaler, in the application's own terms; money in euros. */
export interface Supplier {
  flours(): Promise<Flour[]>;
  /** Places an order; answers the supplier's order number and the total, or soldOut when the depot ran out. */
  place(sku: string, bags: number, deliverOn: string, orderId: string): Promise<{ soldOut: false; supplierOrderNo: string; total: number } | { soldOut: true }>;
}
