import type { Flour } from '../../../domain/model/Flour';

/** Outcome of placing an order: accepted, or the supplier has run out of that flour. */
export type PlaceResult = { soldOut?: false; tooSmall?: false; supplierOrderNo: string; total: number }
  | { soldOut: true }
  | { soldOut?: false; tooSmall: true; missing: number | null };

/** The flour wholesaler, in the application's own terms; money in euros. */
export interface Supplier {
  flours(): Promise<Flour[]>;
  /** Places an order; answers the supplier's order number and the total. */
  place(sku: string, bags: number, deliverOn: string, orderId: string): Promise<PlaceResult>;
}
